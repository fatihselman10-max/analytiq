package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type ReportHandler struct {
	db *database.DB
}

func NewReportHandler(db *database.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

// parsePeriod returns interval SQL and days count from period query param
func parsePeriod(c *gin.Context) (string, int) {
	period := c.DefaultQuery("period", "30d")
	switch period {
	case "today":
		return "today", 0
	case "yesterday":
		return "yesterday", 1
	case "7d":
		return "7 days", 7
	case "30d":
		return "30 days", 30
	case "90d":
		return "90 days", 90
	case "all":
		return "", 0
	default:
		return "30 days", 30
	}
}

// validChannelTypes is the whitelist of allowed channel type values
var validChannelTypes = map[string]bool{
	"whatsapp": true, "instagram": true, "telegram": true, "facebook": true,
	"twitter": true, "vk": true, "email": true, "livechat": true,
}

// reportParams holds parsed and safe query parameters for report queries
type reportParams struct {
	orgID      int64
	interval   string
	channelVal string // empty if no channel filter
}

func parseReportParams(c *gin.Context) reportParams {
	p := reportParams{
		orgID: c.GetInt64("org_id"),
	}
	p.interval, _ = parsePeriod(c)

	ch := c.DefaultQuery("channel", "all")
	if ch != "" && ch != "all" && validChannelTypes[ch] {
		p.channelVal = ch
	}
	return p
}

// buildArgs returns query args: always starts with orgID, adds channel if filtered
func (p reportParams) buildArgs() []interface{} {
	if p.channelVal != "" {
		return []interface{}{p.orgID, p.channelVal}
	}
	return []interface{}{p.orgID}
}

// channelJoin returns the JOIN clause for channel filtering
func (p reportParams) channelJoin(tableAlias string) string {
	if p.channelVal == "" {
		return ""
	}
	return " JOIN channels ch_filter ON ch_filter.id = " + tableAlias + ".channel_id"
}

// channelFilter returns the WHERE clause for channel filtering
func (p reportParams) channelFilter() string {
	if p.channelVal == "" {
		return ""
	}
	return " AND ch_filter.type = $2"
}

// dateFilter returns the date filter clause for a given column
func (p reportParams) dateFilter(col string) string {
	if p.interval == "" {
		return ""
	}
	switch p.interval {
	case "today":
		return " AND " + col + " >= CURRENT_DATE"
	case "yesterday":
		return " AND " + col + " >= CURRENT_DATE - INTERVAL '1 day' AND " + col + " < CURRENT_DATE"
	default:
		return " AND " + col + " >= NOW() - INTERVAL '" + p.interval + "'"
	}
}

func (h *ReportHandler) Overview(c *gin.Context) {
	p := parseReportParams(c)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var report models.ReportOverview
	args := p.buildArgs()
	chJoin := p.channelJoin("conv")
	chFilter := p.channelFilter()
	df := p.dateFilter("conv.created_at")

	// Total and open conversations
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE conv.status = 'open')
		 FROM conversations conv`+chJoin+` WHERE conv.org_id = $1`+df+chFilter, args...,
	).Scan(&report.TotalConversations, &report.OpenConversations)

	// Resolved count
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM conversations conv`+chJoin+` WHERE conv.org_id = $1 AND conv.status = 'resolved'`+df+chFilter, args...,
	).Scan(&report.ResolvedCount)

	// Average response time (minutes)
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (conv.first_response_at - conv.created_at)) / 60), 0)
		 FROM conversations conv`+chJoin+` WHERE conv.org_id = $1 AND conv.first_response_at IS NOT NULL`+df+chFilter, args...,
	).Scan(&report.AvgResponseTime)

	// Average resolution time (minutes)
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (conv.resolved_at - conv.created_at)) / 60), 0)
		 FROM conversations conv`+chJoin+` WHERE conv.org_id = $1 AND conv.resolved_at IS NOT NULL`+df+chFilter, args...,
	).Scan(&report.AvgResolutionTime)

	// Daily volume
	dailyDF := df
	if dailyDF == "" {
		dailyDF = " AND conv.created_at >= NOW() - INTERVAL '90 days'"
	}
	rows, err := h.db.Pool.Query(ctx,
		`SELECT DATE(conv.created_at) AS d, COUNT(*)
		 FROM conversations conv`+chJoin+` WHERE conv.org_id = $1`+dailyDF+chFilter+`
		 GROUP BY d ORDER BY d`, args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var dv models.DailyVolume
			var dt time.Time
			if rows.Scan(&dt, &dv.Count) == nil {
				dv.Date = dt.Format("2006-01-02")
				report.DailyVolume = append(report.DailyVolume, dv)
			}
		}
	}

	c.JSON(http.StatusOK, report)
}

func (h *ReportHandler) Agents(c *gin.Context) {
	p := parseReportParams(c)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	args := p.buildArgs()
	chJoin := p.channelJoin("c")
	chFilter := p.channelFilter()
	df := p.dateFilter("c.created_at")

	rows, err := h.db.Pool.Query(ctx,
		`SELECT u.id, u.full_name,
		        COUNT(c.id) AS conversation_count,
		        COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60), 0) AS avg_response,
		        COUNT(c.id) FILTER (WHERE c.status = 'resolved') AS resolved_count
		 FROM users u
		 JOIN org_members om ON om.user_id = u.id AND om.org_id = $1
		 LEFT JOIN conversations c ON c.assigned_to = u.id AND c.org_id = $1`+df+chJoin+chFilter+`
		 GROUP BY u.id, u.full_name
		 ORDER BY conversation_count DESC`, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agent reports"})
		return
	}
	defer rows.Close()

	agents := []models.AgentReport{}
	for rows.Next() {
		var a models.AgentReport
		if err := rows.Scan(&a.UserID, &a.FullName, &a.ConversationCount, &a.AvgResponseTime, &a.ResolvedCount); err == nil {
			if a.ConversationCount > 0 {
				a.ResolutionRate = float64(a.ResolvedCount) / float64(a.ConversationCount) * 100
			}
			agents = append(agents, a)
		}
	}

	c.JSON(http.StatusOK, gin.H{"agents": agents})
}

func (h *ReportHandler) Channels(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	interval, _ := parsePeriod(c)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	dateFilter := ""
	if interval != "" {
		switch interval {
		case "today":
			dateFilter = " AND c.created_at >= CURRENT_DATE"
		case "yesterday":
			dateFilter = " AND c.created_at >= CURRENT_DATE - INTERVAL '1 day' AND c.created_at < CURRENT_DATE"
		default:
			dateFilter = " AND c.created_at >= NOW() - INTERVAL '" + interval + "'"
		}
	}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT ch.type, COUNT(c.id)
		 FROM conversations c
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.org_id = $1`+dateFilter+`
		 GROUP BY ch.type
		 ORDER BY COUNT(c.id) DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channel reports"})
		return
	}
	defer rows.Close()

	channels := []models.ChannelReport{}
	for rows.Next() {
		var cr models.ChannelReport
		if err := rows.Scan(&cr.ChannelType, &cr.Count); err == nil {
			channels = append(channels, cr)
		}
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

func (h *ReportHandler) SocialChannels(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx, `
		SELECT ch.type,
		       COUNT(conv.id) AS total,
		       COUNT(conv.id) FILTER (WHERE conv.status = 'open') AS open,
		       COUNT(conv.id) FILTER (WHERE conv.customer_id IS NOT NULL) AS linked,
		       COALESCE(AVG(EXTRACT(EPOCH FROM (conv.first_response_at - conv.created_at)) / 60)
		                FILTER (WHERE conv.first_response_at IS NOT NULL), 0) AS avg_resp,
		       MAX(conv.last_message_at) AS last_msg,
		       (SELECT COUNT(*) FROM messages m
		        JOIN conversations c2 ON c2.id = m.conversation_id
		        WHERE c2.org_id = $1 AND c2.channel_id = ch.id
		          AND m.sender_type = 'contact'
		          AND m.created_at >= CURRENT_DATE) AS today_msgs
		FROM channels ch
		LEFT JOIN conversations conv ON conv.channel_id = ch.id AND conv.org_id = $1
		       AND conv.created_at >= NOW() - INTERVAL '30 days'
		WHERE ch.org_id = $1 AND ch.type IN ('instagram', 'telegram', 'vk')
		GROUP BY ch.id, ch.type
		ORDER BY ch.type`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch social channel stats"})
		return
	}
	defer rows.Close()

	stats := []models.SocialChannelStat{}
	for rows.Next() {
		var s models.SocialChannelStat
		var lastMsg *time.Time
		if err := rows.Scan(&s.ChannelType, &s.TotalConversations, &s.OpenConversations,
			&s.CustomerLinked, &s.AvgResponseMinutes, &lastMsg, &s.MessagesToday); err == nil {
			if lastMsg != nil {
				formatted := lastMsg.Format(time.RFC3339)
				s.LastMessageAt = &formatted
			}
			stats = append(stats, s)
		}
	}

	c.JSON(http.StatusOK, gin.H{"channels": stats})
}

var fairActivityLabels = map[string]string{
	"intro_video_sent":      "Rusça tanıtım filmi",
	"warehouse_video_sent":  "Depo videosu",
	"fair_invitation":       "Fuar daveti",
	"initial_contact":       "İlk iletişim",
	"bulk_message":          "Toplu bilgilendirme",
	"catalog_request":       "Katalog",
	"kartela_request":       "Kartela",
	"sample_request":        "Numune",
	"price_inquiry":         "Fiyat sorgusu",
	"note":                  "Not",
}

func fairActivityLabel(t string) string {
	if l, ok := fairActivityLabels[t]; ok {
		return l
	}
	return t
}

func (h *ReportHandler) Fairs(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
	defer cancel()

	// Customers tied to fairs
	rows, err := h.db.Pool.Query(ctx, `
		SELECT c.id, COALESCE(c.name,''), COALESCE(c.company,''),
		       COALESCE(c.country,''), c.segment,
		       COALESCE(c.pipeline_stage, 'new_contact'),
		       COALESCE(c.orders,'') NOT IN ('', '-') AS has_orders,
		       c.last_contact_at, c.source_detail
		FROM customers c
		WHERE c.org_id = $1
		  AND (c.source ILIKE 'fair' OR c.source ILIKE 'fuar')
		  AND c.source_detail != ''
		ORDER BY c.source_detail, c.segment ASC, c.last_contact_at DESC NULLS LAST`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch fair customers"})
		return
	}

	grouped := map[string]*models.FairReport{}
	customerToFair := map[int64]string{}
	for rows.Next() {
		var cust models.FairCustomer
		var fairName string
		var lastContact *time.Time
		if err := rows.Scan(&cust.ID, &cust.Name, &cust.Company, &cust.Country,
			&cust.Segment, &cust.PipelineStage, &cust.HasOrders,
			&lastContact, &fairName); err != nil {
			continue
		}
		if lastContact != nil {
			s := lastContact.Format(time.RFC3339)
			cust.LastContactAt = &s
		}

		fair, ok := grouped[fairName]
		if !ok {
			fair = &models.FairReport{
				Name:           fairName,
				Customers:      []models.FairCustomer{},
				ActivityTypes:  []models.FairActivityType{},
				RecentActivity: []models.FairActivityItem{},
			}
			grouped[fairName] = fair
		}
		fair.TotalContacts++
		switch cust.Segment {
		case 1:
			fair.VIPCount++
		case 2:
			fair.ActiveCount++
		case 3:
			fair.PotentialCount++
		default:
			fair.ColdCount++
		}
		switch cust.PipelineStage {
		case "order_received", "shipping":
			fair.OrderStage++
		case "sample_sent":
			fair.SampleStage++
		case "catalog_sent", "kartela_sent":
			fair.CatalogStage++
		default:
			fair.NewStage++
		}
		if cust.HasOrders {
			fair.WithOrders++
		}
		if cust.LastContactAt != nil {
			if fair.LastContactAt == nil || *cust.LastContactAt > *fair.LastContactAt {
				fair.LastContactAt = cust.LastContactAt
			}
		}
		fair.Customers = append(fair.Customers, cust)
		customerToFair[cust.ID] = fairName
	}
	rows.Close()

	// Activity type aggregation per fair
	typeRows, err := h.db.Pool.Query(ctx, `
		SELECT c.source_detail, a.activity_type, COUNT(a.id)
		FROM customer_activities a
		JOIN customers c ON c.id = a.customer_id
		WHERE a.org_id = $1 AND c.org_id = $1
		  AND (c.source ILIKE 'fair' OR c.source ILIKE 'fuar')
		  AND c.source_detail != ''
		GROUP BY c.source_detail, a.activity_type`, orgID)
	if err == nil {
		for typeRows.Next() {
			var fairName, actType string
			var cnt int
			if err := typeRows.Scan(&fairName, &actType, &cnt); err != nil {
				continue
			}
			if fair, ok := grouped[fairName]; ok {
				fair.ActivityCount += cnt
				fair.ActivityTypes = append(fair.ActivityTypes, models.FairActivityType{
					Type:  actType,
					Label: fairActivityLabel(actType),
					Count: cnt,
				})
			}
		}
		typeRows.Close()
	}

	// Recent activity per fair (last 6 per fair)
	actRows, err := h.db.Pool.Query(ctx, `
		SELECT a.id, a.customer_id, c.name, a.activity_type, a.title, a.created_at,
		       c.source_detail
		FROM customer_activities a
		JOIN customers c ON c.id = a.customer_id
		WHERE a.org_id = $1 AND c.org_id = $1
		  AND (c.source ILIKE 'fair' OR c.source ILIKE 'fuar')
		  AND c.source_detail != ''
		ORDER BY a.created_at DESC
		LIMIT 500`, orgID)
	if err == nil {
		perFairCount := map[string]int{}
		for actRows.Next() {
			var item models.FairActivityItem
			var createdAt time.Time
			var fairName string
			if err := actRows.Scan(&item.ID, &item.CustomerID, &item.CustomerName,
				&item.Type, &item.Title, &createdAt, &fairName); err != nil {
				continue
			}
			if perFairCount[fairName] >= 6 {
				continue
			}
			item.CreatedAt = createdAt.Format(time.RFC3339)
			if fair, ok := grouped[fairName]; ok {
				fair.RecentActivity = append(fair.RecentActivity, item)
				perFairCount[fairName]++
			}
		}
		actRows.Close()
	}

	// Sort activity types per fair by count desc, keep top 6
	for _, fair := range grouped {
		for i := 0; i < len(fair.ActivityTypes); i++ {
			for j := i + 1; j < len(fair.ActivityTypes); j++ {
				if fair.ActivityTypes[j].Count > fair.ActivityTypes[i].Count {
					fair.ActivityTypes[i], fair.ActivityTypes[j] = fair.ActivityTypes[j], fair.ActivityTypes[i]
				}
			}
		}
		if len(fair.ActivityTypes) > 6 {
			fair.ActivityTypes = fair.ActivityTypes[:6]
		}
	}

	fairs := make([]models.FairReport, 0, len(grouped))
	for _, f := range grouped {
		fairs = append(fairs, *f)
	}
	// Sort fairs by total contacts desc
	for i := 0; i < len(fairs); i++ {
		for j := i + 1; j < len(fairs); j++ {
			if fairs[j].TotalContacts > fairs[i].TotalContacts {
				fairs[i], fairs[j] = fairs[j], fairs[i]
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"fairs": fairs})
}

// Turkish stop words to exclude from keyword analysis
var stopWords = map[string]bool{
	"bir": true, "ve": true, "bu": true, "da": true, "de": true,
	"ile": true, "ben": true, "sen": true, "biz": true, "siz": true,
	"o": true, "ne": true, "var": true, "yok": true, "ama": true,
	"için": true, "mi": true, "mu": true, "mı": true, "mü": true,
	"gibi": true, "daha": true, "çok": true, "en": true, "her": true,
	"ya": true, "olan": true, "olarak": true, "kadar": true, "sonra": true,
	"önce": true, "şey": true, "bana": true, "sana": true, "ona": true,
	"nasıl": true, "neden": true, "evet": true, "hayır": true,
	"the": true, "is": true, "a": true, "an": true, "and": true,
	"or": true, "in": true, "on": true, "at": true, "to": true,
	"it": true, "of": true, "i": true, "you": true, "he": true,
	"she": true, "we": true, "they": true, "me": true, "my": true,
	"hi": true, "hello": true, "merhaba": true, "selam": true,
	"iyi": true, "günler": true, "lütfen": true, "teşekkürler": true,
	"tamam": true, "eder": true, "olur": true, "oldu": true,
	"ki": true, "ise": true, "hem": true, "bile": true, "sadece": true,
}

func (h *ReportHandler) MessageAnalytics(c *gin.Context) {
	p := parseReportParams(c)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var result models.MessageAnalytics
	args := p.buildArgs()
	chJoin := p.channelJoin("c")
	chFilter := p.channelFilter()
	df := p.dateFilter("m.created_at")

	// Message counts by sender type
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE m.sender_type = 'contact'),
		        COUNT(*) FILTER (WHERE m.sender_type = 'agent'),
		        COUNT(*) FILTER (WHERE m.sender_type = 'bot')
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id`+chJoin+`
		 WHERE c.org_id = $1 AND m.is_internal = false`+df+chFilter, args...,
	).Scan(&result.TotalMessages, &result.CustomerMessages, &result.AgentMessages, &result.BotMessages)

	// Hourly volume (hour of day distribution)
	hRows, err := h.db.Pool.Query(ctx,
		`SELECT EXTRACT(HOUR FROM m.created_at)::int AS h, COUNT(*)
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id`+chJoin+`
		 WHERE c.org_id = $1 AND m.sender_type = 'contact' AND m.is_internal = false`+df+chFilter+`
		 GROUP BY h ORDER BY h`, args...)
	if err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var hv models.HourlyVolume
			if hRows.Scan(&hv.Hour, &hv.Count) == nil {
				result.HourlyVolume = append(result.HourlyVolume, hv)
			}
		}
	}

	// Daily messages
	dailyDF := df
	if dailyDF == "" {
		dailyDF = " AND m.created_at >= NOW() - INTERVAL '90 days'"
	}
	dRows, err := h.db.Pool.Query(ctx,
		`SELECT DATE(m.created_at) AS d, COUNT(*)
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id`+chJoin+`
		 WHERE c.org_id = $1 AND m.is_internal = false`+dailyDF+chFilter+`
		 GROUP BY d ORDER BY d`, args...)
	if err == nil {
		defer dRows.Close()
		for dRows.Next() {
			var dv models.DailyVolume
			var dt time.Time
			if dRows.Scan(&dt, &dv.Count) == nil {
				dv.Date = dt.Format("2006-01-02")
				result.DailyMessages = append(result.DailyMessages, dv)
			}
		}
	}

	// Keywords from customer messages (word frequency)
	msgRows, err := h.db.Pool.Query(ctx,
		`SELECT m.content
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id`+chJoin+`
		 WHERE c.org_id = $1 AND m.sender_type = 'contact' AND m.is_internal = false
		       AND m.content_type = 'text' AND LENGTH(m.content) > 2`+df+chFilter+`
		 ORDER BY m.created_at DESC
		 LIMIT 2000`, args...)
	if err == nil {
		defer msgRows.Close()
		wordCounts := map[string]int{}
		for msgRows.Next() {
			var content string
			if msgRows.Scan(&content) == nil {
				words := extractWords(content)
				for _, w := range words {
					wordCounts[w]++
				}
			}
		}

		// Top 20 keywords
		type kv struct {
			k string
			v int
		}
		var sorted []kv
		for k, v := range wordCounts {
			if v >= 2 {
				sorted = append(sorted, kv{k, v})
			}
		}
		// Simple selection sort for top 20
		for i := 0; i < len(sorted) && i < 20; i++ {
			maxIdx := i
			for j := i + 1; j < len(sorted); j++ {
				if sorted[j].v > sorted[maxIdx].v {
					maxIdx = j
				}
			}
			sorted[i], sorted[maxIdx] = sorted[maxIdx], sorted[i]
		}
		limit := 20
		if len(sorted) < limit {
			limit = len(sorted)
		}
		for i := 0; i < limit; i++ {
			result.Keywords = append(result.Keywords, models.KeywordCount{
				Word:  sorted[i].k,
				Count: sorted[i].v,
			})
		}
	}

	c.JSON(http.StatusOK, result)
}

func extractWords(text string) []string {
	text = strings.ToLower(text)
	var words []string
	var current []rune
	for _, r := range text {
		if unicode.IsLetter(r) {
			current = append(current, r)
		} else {
			if len(current) >= 3 {
				w := string(current)
				if !stopWords[w] {
					words = append(words, w)
				}
			}
			current = current[:0]
		}
	}
	if len(current) >= 3 {
		w := string(current)
		if !stopWords[w] {
			words = append(words, w)
		}
	}
	return words
}
