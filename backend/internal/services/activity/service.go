package activity

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
)

type Service struct {
	db       *database.DB
	analyzer *Analyzer
}

func NewService(db *database.DB, apiKey string) *Service {
	return &Service{
		db:       db,
		analyzer: NewAnalyzer(apiKey),
	}
}

// AnalyzeIncoming runs the analyzer on a contact-sent message and inserts pending activities.
// Signature matches channel.IncomingHook.
//
// Patron directive 2026-05-11 disabled auto-creating customer CARDS from inbound messages.
// That does NOT mean "skip AI" — the directive was about customer creation, not detection.
// Earlier code mistakenly early-returned when customerID was nil, causing ~%91 of Telegram
// conversations (orphan) to bypass detection entirely. 2026-05-16: we now analyze every
// inbound message; orphan detections are stored with customer_id NULL and surfaced in the
// pending queue tagged "Müşterisiz". Approval flow creates the customer at that point.
func (s *Service) AnalyzeIncoming(orgID int64, customerID *int64, messageID int64, channel, text string) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	detections := s.analyzer.Analyze(ctx, text, channel)
	if len(detections) == 0 {
		detections = s.analyzer.AnalyzeWithAI(ctx, text, channel)
	}
	if len(detections) == 0 {
		return
	}

	// Resolve contact_id + conversation_id from the message so orphan activities are still
	// pointing at a real conversation/contact (essential for the "Müşteri olarak ekle" approval flow).
	var contactID, conversationID *int64
	{
		var cid, cvid int64
		err := s.db.Pool.QueryRow(ctx,
			`SELECT cv.contact_id, cv.id
			 FROM messages m JOIN conversations cv ON cv.id = m.conversation_id
			 WHERE m.id = $1 AND cv.org_id = $2`,
			messageID, orgID).Scan(&cid, &cvid)
		if err == nil {
			if cid > 0 {
				contactID = &cid
			}
			if cvid > 0 {
				conversationID = &cvid
			}
		}
	}

	hasCustomer := customerID != nil && *customerID > 0

	for _, d := range detections {
		// Dedupe within 1 hour. Customer varsa customer'a göre, yoksa contact'a göre.
		var dupID int64
		if hasCustomer {
			s.db.Pool.QueryRow(ctx,
				`SELECT id FROM customer_activities
				 WHERE customer_id=$1 AND activity_type=$2 AND status='pending'
				   AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
				*customerID, d.ActivityType).Scan(&dupID)
		} else if contactID != nil {
			s.db.Pool.QueryRow(ctx,
				`SELECT id FROM customer_activities
				 WHERE contact_id=$1 AND activity_type=$2 AND status='pending'
				   AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
				*contactID, d.ActivityType).Scan(&dupID)
		}
		if dupID > 0 {
			continue
		}

		var custArg interface{}
		if hasCustomer {
			custArg = *customerID
		} else {
			custArg = nil
		}
		_, err := s.db.Pool.Exec(ctx,
			`INSERT INTO customer_activities
			   (org_id, customer_id, contact_id, conversation_id, activity_type, title, description,
			    channel, metadata, status, detected_by, confidence, source_message_id, source_text)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13)`,
			orgID, custArg, contactID, conversationID, d.ActivityType, d.Title, d.Description,
			channel, d.Metadata, d.DetectedBy, d.Confidence, messageID, text,
		)
		if err != nil {
			log.Printf("activity: failed to insert pending: %v", err)
		}
	}
}

// AnalyzeOutgoing inspects an agent-sent (echo) message and, if it confirms a CRM-relevant
// action ("numuneyi gönderdim", "kataloğu attım", "fiyatı söyledim", vs.), advances the
// customer's pipeline + segment and writes an approved timeline activity. No human approval
// step — the staff already performed the action by sending the message.
func (s *Service) AnalyzeOutgoing(orgID int64, customerID *int64, contactID, messageID int64, channel, text string) {
	if customerID == nil || *customerID == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	action := detectOutgoingAction(text)
	if action == "" {
		return
	}

	mapping, ok := outgoingActionMap[action]
	if !ok {
		return
	}

	// Dedupe — skip if same action just logged for this customer in last 30 min
	var dupID int64
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id FROM customer_activities
		 WHERE customer_id=$1 AND activity_type=$2
		   AND created_at > NOW() - INTERVAL '30 minutes' LIMIT 1`,
		*customerID, mapping.activityType).Scan(&dupID)
	if err == nil && dupID > 0 {
		return
	}

	// Write timeline activity (approved — staff already did it)
	s.db.Pool.Exec(ctx,
		`INSERT INTO customer_activities
		   (org_id, customer_id, activity_type, title, description, channel, source_message_id, source_text,
		    status, detected_by, confidence)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved','ai_outgoing',85)`,
		orgID, *customerID, mapping.activityType, mapping.title,
		"Personel "+channel+" üzerinden bu aksiyonu gerçekleştirdi.",
		channel, messageID, truncateLog(text, 280))

	// Pipeline advance — forward-only, mirrors the rule used in customer_handler.UpdatePipelineStage
	if mapping.pipelineStage == "" {
		return
	}
	pipelineRank := map[string]int{
		"new_contact": 0, "contacted": 1, "catalog_sent": 2,
		"kartela_sent": 3, "sample_sent": 4, "order_received": 5, "shipping": 6,
	}
	var oldStage string
	var currentSegment int
	if err := s.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(pipeline_stage,'new_contact'), segment FROM customers WHERE id=$1 AND org_id=$2`,
		*customerID, orgID).Scan(&oldStage, &currentSegment); err != nil {
		return
	}
	if pipelineRank[mapping.pipelineStage] <= pipelineRank[oldStage] {
		return
	}
	newSegment := currentSegment
	if mapping.autoSegment > 0 && mapping.autoSegment < currentSegment {
		newSegment = mapping.autoSegment
	}
	s.db.Pool.Exec(ctx,
		`UPDATE customers SET pipeline_stage=$1, pipeline_updated_at=NOW(), segment=$2, updated_at=NOW() WHERE id=$3 AND org_id=$4`,
		mapping.pipelineStage, newSegment, *customerID, orgID)
	if newSegment != currentSegment {
		s.db.Pool.Exec(ctx,
			`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment) VALUES ($1,$2,$3,$4)`,
			orgID, *customerID, currentSegment, newSegment)
	}
}

type outgoingActionRule struct {
	pipelineStage string
	autoSegment   int
	activityType  string
	title         string
}

var outgoingActionMap = map[string]outgoingActionRule{
	"sample_sent":   {"sample_sent", 2, "sample_sent", "Numune gönderildi"},
	"kartela_sent":  {"kartela_sent", 2, "kartela_sent", "Kartela gönderildi"},
	"catalog_sent":  {"catalog_sent", 0, "catalog_sent", "Katalog gönderildi"},
	"price_quoted":  {"", 0, "price_quoted", "Fiyat verildi"},
	"order_received": {"order_received", 1, "order", "Sipariş alındı"},
	"shipping_sent": {"shipping", 1, "shipping_info", "Kargoya verildi"},
	"meeting_set":   {"", 0, "meeting", "Görüşme ayarlandı"},
}

// detectOutgoingAction is a lightweight keyword pass over agent-sent text in TR/EN/RU.
// Returns "" when no clear staff action is detected.
func detectOutgoingAction(text string) string {
	t := strings.ToLower(text)

	// Sample sent
	if (strings.Contains(t, "numune") && (strings.Contains(t, "gönder") || strings.Contains(t, "yolla") || strings.Contains(t, "kargo"))) ||
		strings.Contains(t, "образцы отправ") || strings.Contains(t, "sample sent") || strings.Contains(t, "образцы выслал") {
		return "sample_sent"
	}
	// Kartela sent
	if strings.Contains(t, "kartela") && (strings.Contains(t, "gönder") || strings.Contains(t, "yolla")) {
		return "kartela_sent"
	}
	if strings.Contains(t, "карт") && strings.Contains(t, "цвет") && (strings.Contains(t, "отправ") || strings.Contains(t, "выслал")) {
		return "kartela_sent"
	}
	// Catalog sent
	if (strings.Contains(t, "katalog") || strings.Contains(t, "catalog")) && (strings.Contains(t, "gönder") || strings.Contains(t, "attı") || strings.Contains(t, "sent")) {
		return "catalog_sent"
	}
	if strings.Contains(t, "каталог") && (strings.Contains(t, "отправ") || strings.Contains(t, "выслал")) {
		return "catalog_sent"
	}
	// Shipping
	if (strings.Contains(t, "kargo") && (strings.Contains(t, "verdik") || strings.Contains(t, "verildi") || strings.Contains(t, "çıktı"))) ||
		strings.Contains(t, "отправили") || strings.Contains(t, "трек") {
		return "shipping_sent"
	}
	// Price quote
	if (strings.Contains(t, "fiyat") && (strings.Contains(t, "söyledim") || strings.Contains(t, "verdim") || strings.Contains(t, "yolladım"))) ||
		strings.Contains(t, "цена") && strings.Contains(t, "сказал") {
		return "price_quoted"
	}
	// Order confirm
	if (strings.Contains(t, "sipariş") && (strings.Contains(t, "aldım") || strings.Contains(t, "onayland"))) ||
		strings.Contains(t, "заказ принят") {
		return "order_received"
	}
	// Meeting set
	if (strings.Contains(t, "görüşme") || strings.Contains(t, "toplantı")) && (strings.Contains(t, "ayarla") || strings.Contains(t, "kuruldu") || strings.Contains(t, "saat")) {
		return "meeting_set"
	}
	return ""
}

func truncateLog(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// BackfillUnlinked walks every open/pending conversation in the org that has no CRM customer
// linked, and re-runs the analyzer on its last few incoming text messages. When intent is
// detected it auto-creates the customer and writes a pending task. One-shot recovery for
// conversations that arrived before the auto-promote logic existed.
func (s *Service) BackfillUnlinked(orgID int64) (created int, customers int, scanned int) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	rows, err := s.db.Pool.Query(ctx,
		`SELECT c.id, c.contact_id, COALESCE(co.external_id, ''), COALESCE(co.name, ''), COALESCE(ch.type, '')
		 FROM conversations c
		 JOIN contacts co ON co.id = c.contact_id
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.org_id = $1 AND c.customer_id IS NULL AND c.status IN ('open','pending')
		 ORDER BY c.last_message_at DESC NULLS LAST
		 LIMIT 500`, orgID)
	if err != nil {
		log.Printf("activity backfill: query unlinked failed: %v", err)
		return
	}
	type convRow struct {
		convID, contactID int64
		senderID, senderName, channelType string
	}
	var convs []convRow
	for rows.Next() {
		var r convRow
		if err := rows.Scan(&r.convID, &r.contactID, &r.senderID, &r.senderName, &r.channelType); err == nil {
			convs = append(convs, r)
		}
	}
	rows.Close()

	createdCustomers := map[int64]bool{}
	for _, r := range convs {
		scanned++
		// Pull the most recent contact-sent text messages on this conversation.
		mrows, err := s.db.Pool.Query(ctx,
			`SELECT id, content FROM messages
			 WHERE conversation_id = $1 AND sender_type = 'contact' AND content_type = 'text'
			   AND content IS NOT NULL AND length(content) > 2
			 ORDER BY created_at DESC LIMIT 3`, r.convID)
		if err != nil {
			continue
		}
		type msgRow struct {
			id      int64
			content string
		}
		var msgs []msgRow
		for mrows.Next() {
			var m msgRow
			if err := mrows.Scan(&m.id, &m.content); err == nil {
				msgs = append(msgs, m)
			}
		}
		mrows.Close()

		// Run analyzer on each message; first detection wins. Stop early if we get a hit.
		var customerID *int64
		for _, m := range msgs {
			detections := s.analyzer.Analyze(ctx, m.content, r.channelType)
			if len(detections) == 0 {
				detections = s.analyzer.AnalyzeWithAI(ctx, m.content, r.channelType)
			}
			if len(detections) == 0 {
				continue
			}
			if customerID == nil {
				newID, err := s.autoCreateCustomer(ctx, orgID, r.contactID, r.senderID, r.senderName, r.channelType)
				if err != nil {
					log.Printf("activity backfill: auto-create failed conv=%d: %v", r.convID, err)
					break
				}
				customerID = &newID
				if !createdCustomers[newID] {
					createdCustomers[newID] = true
					customers++
				}
			}
			for _, d := range detections {
				var dupID int64
				err := s.db.Pool.QueryRow(ctx,
					`SELECT id FROM customer_activities
					 WHERE customer_id=$1 AND activity_type=$2 AND status='pending'
					   AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
					*customerID, d.ActivityType).Scan(&dupID)
				if err == nil && dupID > 0 {
					continue
				}
				_, err = s.db.Pool.Exec(ctx,
					`INSERT INTO customer_activities
					   (org_id, customer_id, activity_type, title, description, channel, metadata,
					    status, detected_by, confidence, source_message_id, source_text)
					 VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,$11)`,
					orgID, *customerID, d.ActivityType, d.Title, d.Description, r.channelType, d.Metadata,
					d.DetectedBy, d.Confidence, m.id, m.content)
				if err == nil {
					created++
				}
			}
			break // one detection per conversation is enough
		}
	}
	return created, customers, scanned
}

// autoCreateCustomer promotes a contact to a CRM customer (Segment 4 = Yeni).
// It also registers the channel identifier so the next message from the same handle matches directly.
// Best-effort: races between concurrent messages from the same contact may produce duplicate
// customers, but the next match-by-channel attempt resolves to the first one.
func (s *Service) autoCreateCustomer(ctx context.Context, orgID, contactID int64, senderID, senderName, channel string) (int64, error) {
	// First check: did a parallel goroutine just create one for this channel identifier?
	if senderID != "" {
		var existingID int64
		err := s.db.Pool.QueryRow(ctx,
			`SELECT cc.customer_id FROM customer_channels cc
			 JOIN customers cu ON cu.id = cc.customer_id AND cu.org_id = $1
			 WHERE LOWER(cc.channel_type) = LOWER($2) AND cc.channel_identifier = $3
			 LIMIT 1`,
			orgID, channel, senderID).Scan(&existingID)
		if err == nil && existingID > 0 {
			return existingID, nil
		}
	}

	name := strings.TrimSpace(senderName)
	if name == "" {
		name = strings.TrimSpace(senderID)
	}
	if name == "" {
		name = "Bilinmeyen müşteri"
	}

	channelLabel := channel
	switch strings.ToLower(channel) {
	case "instagram":
		channelLabel = "Instagram"
	case "telegram":
		channelLabel = "Telegram"
	case "whatsapp":
		channelLabel = "WhatsApp"
	case "vk":
		channelLabel = "VK"
	case "email":
		channelLabel = "Email"
	case "facebook":
		channelLabel = "Facebook"
	}

	// Dedup by name+company tokens: avoid creating a duplicate when the same person was already
	// added manually (fair lead, Excel import) without channel IDs. Requires ≥2 shared tokens
	// (length ≥3) to keep accidental matches like a shared first name from binding wrong cards.
	if matchID := s.findCustomerByNameTokens(ctx, orgID, name); matchID > 0 {
		if senderID != "" {
			s.db.Pool.Exec(ctx,
				`INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
				 VALUES ($1, $2, $3) ON CONFLICT (customer_id, channel_type) DO NOTHING`,
				matchID, channelLabel, senderID,
			)
		}
		s.db.Pool.Exec(ctx,
			`UPDATE conversations SET customer_id = $1
			 WHERE org_id = $2 AND contact_id = $3 AND customer_id IS NULL`,
			matchID, orgID, contactID,
		)
		s.db.Pool.Exec(ctx,
			`UPDATE customers SET last_contact_at = NOW(), updated_at = NOW() WHERE id = $1`,
			matchID,
		)
		return matchID, nil
	}

	var newID int64
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO customers (org_id, name, segment, country, source, source_detail, last_contact_at)
		 VALUES ($1, $2, 4, '', $3, 'Otomatik: gelen mesaj', NOW())
		 RETURNING id`,
		orgID, name, channelLabel,
	).Scan(&newID)
	if err != nil {
		return 0, err
	}

	// Register the channel identifier for future direct matching.
	if senderID != "" {
		s.db.Pool.Exec(ctx,
			`INSERT INTO customer_channels (customer_id, channel_type, channel_identifier)
			 VALUES ($1, $2, $3) ON CONFLICT (customer_id, channel_type) DO NOTHING`,
			newID, channelLabel, senderID,
		)
	}

	// Backfill: link any existing conversations from this contact to the new customer
	// so the agent sees the new CRM record on the existing thread immediately.
	s.db.Pool.Exec(ctx,
		`UPDATE conversations SET customer_id = $1
		 WHERE org_id = $2 AND contact_id = $3 AND customer_id IS NULL`,
		newID, orgID, contactID,
	)

	return newID, nil
}

// findCustomerByNameTokens scans the org's CRM for a customer whose name+company tokens overlap
// with senderName by ≥2 shared tokens (length ≥3). Returns 0 when no confident match exists.
// Token-set is symmetric so "Anna BJ Teks" matches "Anna" + company "BJ Tekstil" via {anna, bj}.
func (s *Service) findCustomerByNameTokens(ctx context.Context, orgID int64, senderName string) int64 {
	tokens := normalizeNameTokens(senderName)
	if len(tokens) < 2 {
		return 0
	}

	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, name, COALESCE(company,'') FROM customers WHERE org_id = $1`,
		orgID,
	)
	if err != nil {
		return 0
	}
	defer rows.Close()

	var bestID int64
	bestScore := 0
	for rows.Next() {
		var id int64
		var cName, cCompany string
		if err := rows.Scan(&id, &cName, &cCompany); err != nil {
			continue
		}
		candidateTokens := normalizeNameTokens(cName + " " + cCompany)
		if len(candidateTokens) == 0 {
			continue
		}
		score := 0
		for t := range tokens {
			if _, ok := candidateTokens[t]; ok {
				score++
			}
		}
		if score >= 2 && score > bestScore {
			bestScore = score
			bestID = id
		}
	}
	return bestID
}

// normalizeNameTokens lowercases, strips accents/quotes/punctuation, and returns the set of
// tokens with length ≥3. Tail tokens like "tekstil"/"textile"/"ltd" are dropped to make
// "BJ Teks" match "BJ Tekstil" via the shared "bj" token.
func normalizeNameTokens(raw string) map[string]struct{} {
	out := make(map[string]struct{})
	if raw == "" {
		return out
	}
	r := strings.ToLower(raw)
	// strip common quote/bracket chars so `Anna "BJ Teks"` tokenizes cleanly
	for _, ch := range []string{"\"", "'", "`", "(", ")", "[", "]", "{", "}", ",", ".", "/", "\\", "·", "•", "-", "—", "–"} {
		r = strings.ReplaceAll(r, ch, " ")
	}
	// turkish + common latin accent fold
	repl := strings.NewReplacer(
		"ı", "i", "İ", "i", "ş", "s", "Ş", "s", "ç", "c", "Ç", "c",
		"ğ", "g", "Ğ", "g", "ö", "o", "Ö", "o", "ü", "u", "Ü", "u",
		"á", "a", "à", "a", "â", "a", "ä", "a", "ã", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o",
		"ú", "u", "ù", "u", "û", "u",
		"ñ", "n",
	)
	r = repl.Replace(r)
	stop := map[string]bool{
		"tekstil": true, "textile": true, "tex": true, "teks": true,
		"ltd": true, "llc": true, "inc": true, "co": true, "company": true,
		"sirketi": true, "sirket": true, "san": true, "tic": true, "ith": true, "ihr": true,
		"the": true, "and": true, "for": true,
		"mr": true, "mrs": true, "ms": true,
	}
	for _, tok := range strings.Fields(r) {
		if len(tok) < 3 {
			continue
		}
		if stop[tok] {
			continue
		}
		out[tok] = struct{}{}
	}
	return out
}
