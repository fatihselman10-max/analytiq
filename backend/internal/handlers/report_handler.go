package handlers

import (
	"context"
	"net/http"
	"time"

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

func (h *ReportHandler) Overview(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var report models.ReportOverview

	// Total and open conversations
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'open')
		 FROM conversations WHERE org_id = $1`, orgID,
	).Scan(&report.TotalConversations, &report.OpenConversations)

	// Resolved count
	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM conversations WHERE org_id = $1 AND status = 'resolved'`, orgID,
	).Scan(&report.ResolvedCount)

	// Average response time (minutes)
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60), 0)
		 FROM conversations WHERE org_id = $1 AND first_response_at IS NOT NULL`, orgID,
	).Scan(&report.AvgResponseTime)

	// Average resolution time (minutes)
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60), 0)
		 FROM conversations WHERE org_id = $1 AND resolved_at IS NOT NULL`, orgID,
	).Scan(&report.AvgResolutionTime)

	// Daily volume (last 30 days)
	rows, err := h.db.Pool.Query(ctx,
		`SELECT DATE(created_at) AS d, COUNT(*)
		 FROM conversations WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY d ORDER BY d`, orgID)
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
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT u.id, u.full_name,
		        COUNT(c.id) AS conversation_count,
		        COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60), 0) AS avg_response,
		        COUNT(c.id) FILTER (WHERE c.status = 'resolved') AS resolved_count
		 FROM users u
		 JOIN org_members om ON om.user_id = u.id AND om.org_id = $1
		 LEFT JOIN conversations c ON c.assigned_to = u.id AND c.org_id = $1
		 GROUP BY u.id, u.full_name
		 ORDER BY conversation_count DESC`, orgID)
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
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT ch.type, COUNT(c.id)
		 FROM conversations c
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.org_id = $1
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
