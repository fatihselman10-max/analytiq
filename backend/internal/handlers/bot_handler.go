package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type BotHandler struct {
	db *database.DB
}

func NewBotHandler(db *database.DB) *BotHandler {
	return &BotHandler{db: db}
}

func (h *BotHandler) ListRules(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, org_id, name, keywords, match_type, response_template, is_active, priority, channel_types, created_at, updated_at
		 FROM bot_rules WHERE org_id = $1 ORDER BY priority DESC, created_at DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rules"})
		return
	}
	defer rows.Close()

	rules := []models.BotRule{}
	for rows.Next() {
		var r models.BotRule
		if err := rows.Scan(&r.ID, &r.OrgID, &r.Name, &r.Keywords, &r.MatchType, &r.ResponseTemplate, &r.IsActive, &r.Priority, &r.ChannelTypes, &r.CreatedAt, &r.UpdatedAt); err == nil {
			rules = append(rules, r)
		}
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *BotHandler) CreateRule(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Name             string   `json:"name" binding:"required"`
		Keywords         []string `json:"keywords" binding:"required"`
		MatchType        string   `json:"match_type"`
		ResponseTemplate string   `json:"response_template" binding:"required"`
		Priority         int      `json:"priority"`
		ChannelTypes     []string `json:"channel_types"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MatchType == "" {
		req.MatchType = "contains"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO bot_rules (org_id, name, keywords, match_type, response_template, priority, channel_types)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		orgID, req.Name, req.Keywords, req.MatchType, req.ResponseTemplate, req.Priority, req.ChannelTypes,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *BotHandler) UpdateRule(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name             string   `json:"name"`
		Keywords         []string `json:"keywords"`
		MatchType        string   `json:"match_type"`
		ResponseTemplate string   `json:"response_template"`
		Priority         *int     `json:"priority"`
		ChannelTypes     []string `json:"channel_types"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE bot_rules SET name = COALESCE(NULLIF($1, ''), name),
		 keywords = COALESCE($2, keywords),
		 match_type = COALESCE(NULLIF($3, ''), match_type),
		 response_template = COALESCE(NULLIF($4, ''), response_template),
		 priority = COALESCE($5, priority),
		 channel_types = COALESCE($6, channel_types),
		 updated_at = NOW()
		 WHERE id = $7 AND org_id = $8`,
		req.Name, req.Keywords, req.MatchType, req.ResponseTemplate, req.Priority, req.ChannelTypes, id, orgID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *BotHandler) DeleteRule(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx, `DELETE FROM bot_rules WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *BotHandler) ToggleRule(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE bot_rules SET is_active = NOT is_active, updated_at = NOW()
		 WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Toggled"})
}

func (h *BotHandler) ListLogs(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT bl.id, bl.org_id, bl.rule_id, bl.conversation_id, bl.matched_keyword, bl.action, bl.created_at,
		        COALESCE(br.name, 'Deleted Rule') AS rule_name
		 FROM bot_logs bl
		 LEFT JOIN bot_rules br ON br.id = bl.rule_id
		 WHERE bl.org_id = $1
		 ORDER BY bl.created_at DESC LIMIT 100`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}
	defer rows.Close()

	logs := []models.BotLog{}
	for rows.Next() {
		var l models.BotLog
		if err := rows.Scan(&l.ID, &l.OrgID, &l.RuleID, &l.ConversationID, &l.MatchedKeyword, &l.Action, &l.CreatedAt, &l.RuleName); err == nil {
			logs = append(logs, l)
		}
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}
