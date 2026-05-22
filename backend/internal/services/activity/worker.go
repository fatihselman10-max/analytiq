package activity

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"
)

// QueueWorker, analysis_queue tablosundan periyodik olarak pending kayıt çekip
// ProcessMessage ile işler. Boot'ta cmd/api/main.go'dan StartQueueWorker(ctx) ile başlatılır.
//
// Tasarım:
//   - 5sn poll interval (yeni mesajları hızlı yakalar; backend yükü düşük)
//   - Her tick'te max 20 kayıt claim ediyoruz; ardından ProcessMessage call
//   - Crash/restart durumunda 'processing' kayıtlar 5 dk sonra otomatik geri pending'e döner
//     (next_attempt_at bekleyen koşulu nedeniyle gerçi processing kalır — bunu reset için
//      ayrı bir reaper işleyecek)
//
// İyileştirme noktası (Katman 5'te): "processing 30dk'dan uzunsa pending'e geri al" reaper.

const (
	workerPollInterval = 5 * time.Second
	workerBatchSize    = 20
	// Reaper: 5dk'dan uzun süredir 'processing'te kalan kayıtları pending'e geri al.
	// Worker crash anında stuck olan job'ları kurtarır (Katman 5).
	reaperInterval = 5 * time.Minute
	reaperStuckAge = "5 minutes"
)

// StartQueueWorker, ctx iptal edilene kadar arka planda kuyruğu boşaltır.
// Graceful shutdown: ctx kapanır → tick'i bitirmeyi bekler → return eder.
// Paralel olarak reaper goroutine başlatır.
func (s *Service) StartQueueWorker(ctx context.Context) {
	log.Printf("[activity-worker] başlatıldı (poll=%v, batch=%d)", workerPollInterval, workerBatchSize)

	// Reaper goroutine — stuck 'processing' kayıtları geri kazanır.
	go s.runReaper(ctx)

	t := time.NewTicker(workerPollInterval)
	defer t.Stop()

	// Boot'ta hemen bir tur attır (sleep beklemeden)
	s.drainOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[activity-worker] ctx done, çıkıyor")
			return
		case <-t.C:
			s.drainOnce(ctx)
		}
	}
}

// runReaper, periyodik olarak 5dk'dan uzun süredir 'processing' kalan kayıtları
// pending'e geri çevirir. Worker crash veya pod restart sonrası stuck job'ları
// kurtarır (Cumartesi memory'de bahsedilen Katman 5 iyileştirmesi).
func (s *Service) runReaper(ctx context.Context) {
	log.Printf("[activity-reaper] başlatıldı (interval=%v, stuck_age=%s)", reaperInterval, reaperStuckAge)
	t := time.NewTicker(reaperInterval)
	defer t.Stop()

	// Boot'ta hemen bir tur — restart sonrası bekleyenler hızla kurtarılsın
	s.reapStuck(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.reapStuck(ctx)
		}
	}
}

// reapStuck, stuck 'processing' kayıtları pending'e geri alır.
func (s *Service) reapStuck(ctx context.Context) {
	tag, err := s.db.Pool.Exec(ctx,
		`UPDATE analysis_queue
		 SET status = 'pending', next_attempt_at = NOW()
		 WHERE status = 'processing'
		   AND last_attempt_at < NOW() - $1::interval`,
		reaperStuckAge,
	)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			log.Printf("[activity-reaper] update error: %v", err)
		}
		return
	}
	if n := tag.RowsAffected(); n > 0 {
		log.Printf("[activity-reaper] %d stuck kayıt pending'e geri çekildi", n)
	}
}

// drainOnce, bir tur claim + process eder.
func (s *Service) drainOnce(ctx context.Context) {
	items, err := s.claimBatch(ctx, workerBatchSize)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			log.Printf("[activity-worker] claimBatch error: %v", err)
		}
		return
	}
	if len(items) == 0 {
		return
	}
	for _, it := range items {
		s.processQueueItem(ctx, it)
	}
}

// processQueueItem, tek bir kuyruk kaydını işler:
//   - mesaj içeriğini çek
//   - analyzer çalıştır (rule → Haiku fallback)
//   - eşleşen detection'lar için customer_activities pending kayıt aç
//   - analysis_attempts'a metrik yaz
//   - başarılıysa markDone, hata varsa markFailedOrRetry
func (s *Service) processQueueItem(ctx context.Context, it claimedItem) {
	start := time.Now()

	// Mesajı + konuşma + customer bilgisini çek
	type msgRow struct {
		content        string
		conversationID int64
		contactID      *int64
		customerID     *int64
		channelType    string
	}
	var m msgRow
	err := s.db.Pool.QueryRow(ctx,
		`SELECT m.content, m.conversation_id, cv.contact_id, cv.customer_id,
		        COALESCE(ch.type, '')
		 FROM messages m
		 JOIN conversations cv ON cv.id = m.conversation_id
		 LEFT JOIN channels ch ON ch.id = cv.channel_id
		 WHERE m.id = $1 AND cv.org_id = $2`,
		it.messageID, it.orgID,
	).Scan(&m.content, &m.conversationID, &m.contactID, &m.customerID, &m.channelType)
	if err != nil {
		// Mesaj silinmiş ya da org_id uyuşmaz → bu kayıt artık anlamsız, done geç
		log.Printf("[activity-worker] msg %d not found, marking done: %v", it.messageID, err)
		_ = s.markDone(ctx, it.queueID)
		s.recordAttempt(ctx, it.orgID, it.messageID, time.Since(start), "missing_message", nil, err.Error())
		return
	}

	// Bu noktadan sonra mevcut AnalyzeIncoming logic'i ile aynı; sadece DB lookup'lar zaten yapıldı.
	detections := s.analyzer.Analyze(ctx, m.content, m.channelType)
	matchedBy := "rule"
	if len(detections) == 0 {
		detections = s.analyzer.AnalyzeWithAI(ctx, m.content, m.channelType)
		matchedBy = "haiku"
	}
	if len(detections) == 0 {
		// Hiçbir şey bulunamadı — başarılı işlem (analyze edildi, sonuç boş). attempt'i kaydet.
		s.recordAttempt(ctx, it.orgID, it.messageID, time.Since(start), "none", nil, "")
		_ = s.markDone(ctx, it.queueID)
		return
	}

	hasCustomer := m.customerID != nil && *m.customerID > 0
	conversationID := m.conversationID

	var lastInsertedID int64
	insertErrs := 0
	lastInsertErr := ""
	for _, d := range detections {
		// Dedupe: aynı saatte aynı tipte pending varsa atla
		var dupID int64
		if hasCustomer {
			s.db.Pool.QueryRow(ctx,
				`SELECT id FROM customer_activities
				 WHERE customer_id=$1 AND activity_type=$2 AND status='pending'
				   AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
				*m.customerID, d.ActivityType).Scan(&dupID)
		} else if m.contactID != nil {
			s.db.Pool.QueryRow(ctx,
				`SELECT id FROM customer_activities
				 WHERE contact_id=$1 AND activity_type=$2 AND status='pending'
				   AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
				*m.contactID, d.ActivityType).Scan(&dupID)
		}
		if dupID > 0 {
			continue
		}

		var custArg interface{}
		if hasCustomer {
			custArg = *m.customerID
		} else {
			custArg = nil
		}
		var inserted int64
		err := s.db.Pool.QueryRow(ctx,
			`INSERT INTO customer_activities
			   (org_id, customer_id, contact_id, conversation_id, activity_type, title, description,
			    channel, metadata, status, detected_by, confidence, source_message_id, source_text)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13)
			 RETURNING id`,
			it.orgID, custArg, m.contactID, conversationID, d.ActivityType, d.Title, d.Description,
			m.channelType, d.Metadata, d.DetectedBy, d.Confidence, it.messageID, m.content,
		).Scan(&inserted)
		if err != nil {
			log.Printf("[activity-worker] insert pending failed (msg=%d type=%s): %v", it.messageID, d.ActivityType, err)
			insertErrs++
			lastInsertErr = fmt.Sprintf("insert %s: %v", d.ActivityType, err)
			continue
		}
		lastInsertedID = inserted
	}

	// Metrik
	var producedID *int64
	if lastInsertedID > 0 {
		producedID = &lastInsertedID
	}
	s.recordAttempt(ctx, it.orgID, it.messageID, time.Since(start), matchedBy, producedID, "")

	if insertErrs > 0 && producedID == nil {
		// Tüm insert'ler başarısızsa retry — gerçek hatayı queue.last_error'a yaz ki diagnose edilebilsin.
		reason := "all activity inserts failed"
		if lastInsertErr != "" {
			reason = reason + " — " + lastInsertErr
			if len(reason) > 400 {
				reason = reason[:400]
			}
		}
		s.markFailedOrRetry(ctx, it.queueID, it.attemptCount, reason)
		return
	}
	_ = s.markDone(ctx, it.queueID)
}
