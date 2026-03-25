package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type CSATHandler struct {
	db *database.DB
}

func NewCSATHandler(db *database.DB) *CSATHandler {
	return &CSATHandler{db: db}
}

func (h *CSATHandler) GetConfig(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var isEnabled bool
	var question, thankYou string
	var delayMin int
	err := h.db.Pool.QueryRow(ctx,
		`SELECT is_enabled, COALESCE(question,''), COALESCE(thank_you_message,''), send_delay_minutes
		 FROM csat_config WHERE org_id = $1`, orgID,
	).Scan(&isEnabled, &question, &thankYou, &delayMin)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"csat_config": gin.H{
			"is_enabled":         false,
			"question":           "Destek deneyiminizi nasıl değerlendirirsiniz?",
			"thank_you_message":  "Geri bildiriminiz için teşekkür ederiz!",
			"send_delay_minutes": 5,
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"csat_config": gin.H{
		"is_enabled":         isEnabled,
		"question":           question,
		"thank_you_message":  thankYou,
		"send_delay_minutes": delayMin,
	}})
}

func (h *CSATHandler) SaveConfig(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		IsEnabled        bool   `json:"is_enabled"`
		Question         string `json:"question"`
		ThankYouMessage  string `json:"thank_you_message"`
		SendDelayMinutes int    `json:"send_delay_minutes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := h.db.Pool.Exec(ctx,
		`INSERT INTO csat_config (org_id, is_enabled, question, thank_you_message, send_delay_minutes)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (org_id) DO UPDATE SET
		   is_enabled=$2, question=$3, thank_you_message=$4, send_delay_minutes=$5, updated_at=NOW()`,
		orgID, req.IsEnabled, req.Question, req.ThankYouMessage, req.SendDelayMinutes,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saved"})
}

// SubmitRating - public endpoint for customers to submit CSAT
func (h *CSATHandler) SubmitRating(c *gin.Context) {
	var req struct {
		ConversationID int64  `json:"conversation_id" binding:"required"`
		Rating         int    `json:"rating" binding:"required"`
		Comment        string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating must be 1-5"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Get conversation details
	var orgID int64
	var contactID, agentID *int64
	var chType string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT c.org_id, c.contact_id, c.assigned_to, COALESCE(ch.type, '')
		 FROM conversations c LEFT JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.id = $1`, req.ConversationID,
	).Scan(&orgID, &contactID, &agentID, &chType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	// Check if already rated
	var exists bool
	h.db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM csat_responses WHERE conversation_id = $1)`, req.ConversationID,
	).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Already rated"})
		return
	}

	_, err = h.db.Pool.Exec(ctx,
		`INSERT INTO csat_responses (org_id, conversation_id, contact_id, agent_id, rating, comment, channel_type)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		orgID, req.ConversationID, contactID, agentID, req.Rating, req.Comment, chType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Thank you!"})
}

// GetResponses - list CSAT responses for org
func (h *CSATHandler) GetResponses(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	period := c.DefaultQuery("period", "30d")
	var days int
	switch period {
	case "7d":
		days = 7
	case "30d":
		days = 30
	case "90d":
		days = 90
	default:
		days = 365
	}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT r.id, r.rating, COALESCE(r.comment,''), r.channel_type, r.created_at,
		        COALESCE(co.name,'Anonim'), COALESCE(u.full_name,'Atanmamış')
		 FROM csat_responses r
		 LEFT JOIN contacts co ON co.id = r.contact_id
		 LEFT JOIN users u ON u.id = r.agent_id
		 WHERE r.org_id = $1 AND r.created_at > NOW() - INTERVAL '1 day' * $2
		 ORDER BY r.created_at DESC LIMIT 200`, orgID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type response struct {
		ID          int64  `json:"id"`
		Rating      int    `json:"rating"`
		Comment     string `json:"comment"`
		ChannelType string `json:"channel_type"`
		CreatedAt   string `json:"created_at"`
		ContactName string `json:"contact_name"`
		AgentName   string `json:"agent_name"`
	}
	responses := []response{}
	for rows.Next() {
		var r response
		var createdAt time.Time
		if err := rows.Scan(&r.ID, &r.Rating, &r.Comment, &r.ChannelType, &createdAt, &r.ContactName, &r.AgentName); err == nil {
			r.CreatedAt = createdAt.Format(time.RFC3339)
			responses = append(responses, r)
		}
	}

	// Calculate stats
	var avgRating float64
	var totalCount, satisfiedCount int
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(rating),0), COUNT(*), COUNT(*) FILTER (WHERE rating >= 4)
		 FROM csat_responses WHERE org_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2`,
		orgID, days,
	).Scan(&avgRating, &totalCount, &satisfiedCount)

	var satisfactionRate float64
	if totalCount > 0 {
		satisfactionRate = float64(satisfiedCount) / float64(totalCount) * 100
	}

	// Rating distribution
	dist := make([]int, 5)
	distRows, _ := h.db.Pool.Query(ctx,
		`SELECT rating, COUNT(*) FROM csat_responses
		 WHERE org_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
		 GROUP BY rating ORDER BY rating`, orgID, days)
	if distRows != nil {
		defer distRows.Close()
		for distRows.Next() {
			var r, cnt int
			if distRows.Scan(&r, &cnt) == nil && r >= 1 && r <= 5 {
				dist[r-1] = cnt
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"responses":         responses,
		"avg_rating":        avgRating,
		"total_count":       totalCount,
		"satisfaction_rate":  satisfactionRate,
		"rating_distribution": dist,
	})
}
