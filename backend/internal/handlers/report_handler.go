package handlers

import (
	"context"
	"encoding/json"
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

// ChannelHealth returns per-channel liveness for the Patron page.
// Status is derived from seconds-since-last-inbound-message:
//   - ok      : last message within 24h
//   - warn    : 24h-72h
//   - stale   : >72h on an active channel
//   - no_data : channel active but never received a message
//   - disabled: is_active=false
//
// Telegram channels additionally surface subscription_ok + missing_updates + pending_updates
// pulled from credentials.last_subscription_status (populated by EnsureSubscription).
func (h *ReportHandler) ChannelHealth(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx, `
		SELECT ch.id, ch.type, ch.name, ch.is_active,
		       COALESCE(EXTRACT(EPOCH FROM (NOW() - last_msg.last_at))::bigint, -1) AS seconds_since_last,
		       COALESCE(ch.credentials::text, '{}') AS credentials
		FROM channels ch
		LEFT JOIN LATERAL (
			SELECT MAX(m.created_at) AS last_at
			FROM conversations c
			JOIN messages m ON m.conversation_id = c.id
			WHERE c.channel_id = ch.id AND c.org_id = ch.org_id
			  AND m.sender_type = 'contact'
		) last_msg ON TRUE
		WHERE ch.org_id = $1
		ORDER BY ch.is_active DESC, seconds_since_last ASC NULLS LAST, ch.id`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channel health"})
		return
	}
	defer rows.Close()

	type channelItem struct {
		ID                       int64    `json:"id"`
		Type                     string   `json:"type"`
		Name                     string   `json:"name"`
		Status                   string   `json:"status"`
		SecondsSinceLastMessage  int64    `json:"seconds_since_last_message"`
		SubscriptionOK           *bool    `json:"subscription_ok,omitempty"`
		MissingUpdates           []string `json:"missing_updates,omitempty"`
		PendingUpdates           *int     `json:"pending_updates,omitempty"`
	}

	channels := []channelItem{}
	for rows.Next() {
		var (
			id, secs int64
			ct, name, credsStr string
			active bool
		)
		if err := rows.Scan(&id, &ct, &name, &active, &secs, &credsStr); err != nil {
			continue
		}

		item := channelItem{ID: id, Type: ct, Name: name, SecondsSinceLastMessage: secs}

		switch {
		case !active:
			item.Status = "disabled"
		case secs < 0:
			item.Status = "no_data"
		case secs < 24*3600:
			item.Status = "ok"
		case secs < 72*3600:
			item.Status = "warn"
		default:
			item.Status = "stale"
		}

		// Telegram-specific: read last_subscription_status from credentials JSON.
		// EnsureSubscription writes { last_subscription_status: { ok, missing_updates, pending_update_count } }
		if ct == "telegram" {
			var creds map[string]interface{}
			if err := jsonUnmarshalString(credsStr, &creds); err == nil {
				if sub, ok := creds["last_subscription_status"].(map[string]interface{}); ok {
					if okVal, ok := sub["ok"].(bool); ok {
						item.SubscriptionOK = &okVal
					}
					if missing, ok := sub["missing_updates"].([]interface{}); ok {
						for _, m := range missing {
							if s, ok := m.(string); ok {
								item.MissingUpdates = append(item.MissingUpdates, s)
							}
						}
					}
					if pc, ok := sub["pending_update_count"].(float64); ok {
						p := int(pc)
						item.PendingUpdates = &p
					}
				}
			}
		}

		channels = append(channels, item)
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

func jsonUnmarshalString(s string, v interface{}) error {
	return json.Unmarshal([]byte(s), v)
}
