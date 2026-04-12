package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type AutoReplyHandler struct {
	db *database.DB
}

func NewAutoReplyHandler(db *database.DB) *AutoReplyHandler {
	return &AutoReplyHandler{db: db}
}

type autoReplyResp struct {
	ID               int64     `json:"id"`
	Name             string    `json:"name"`
	Message          string    `json:"message"`
	ChannelType      string    `json:"channel_type"`
	Country          string    `json:"country"`
	IsEnabled        bool      `json:"is_enabled"`
	OnlyFirstMessage bool      `json:"only_first_message"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (h *AutoReplyHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, COALESCE(name,''), COALESCE(message,''), COALESCE(channel_type,''),
		        COALESCE(country,''), is_enabled, only_first_message, created_at, updated_at
		 FROM auto_replies WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	var replies []autoReplyResp
	for rows.Next() {
		var r autoReplyResp
		if err := rows.Scan(&r.ID, &r.Name, &r.Message, &r.ChannelType,
			&r.Country, &r.IsEnabled, &r.OnlyFirstMessage, &r.CreatedAt, &r.UpdatedAt); err != nil {
			continue
		}
		replies = append(replies, r)
	}
	if replies == nil {
		replies = []autoReplyResp{}
	}

	c.JSON(http.StatusOK, gin.H{"auto_replies": replies})
}

func (h *AutoReplyHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Name             string `json:"name"`
		Message          string `json:"message" binding:"required"`
		ChannelType      string `json:"channel_type"`
		Country          string `json:"country"`
		IsEnabled        bool   `json:"is_enabled"`
		OnlyFirstMessage bool   `json:"only_first_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO auto_replies (org_id, name, message, channel_type, country, is_enabled, only_first_message)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		orgID, req.Name, req.Message, req.ChannelType, req.Country, req.IsEnabled, req.OnlyFirstMessage,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": id, "message": "Created"})
}

func (h *AutoReplyHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name             *string `json:"name"`
		Message          *string `json:"message"`
		ChannelType      *string `json:"channel_type"`
		Country          *string `json:"country"`
		IsEnabled        *bool   `json:"is_enabled"`
		OnlyFirstMessage *bool   `json:"only_first_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE auto_replies SET
		   name = COALESCE($3, name),
		   message = COALESCE($4, message),
		   channel_type = COALESCE($5, channel_type),
		   country = COALESCE($6, country),
		   is_enabled = COALESCE($7, is_enabled),
		   only_first_message = COALESCE($8, only_first_message),
		   updated_at = NOW()
		 WHERE id = $1 AND org_id = $2`,
		id, orgID, req.Name, req.Message, req.ChannelType, req.Country, req.IsEnabled, req.OnlyFirstMessage,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *AutoReplyHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx, `DELETE FROM auto_replies WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// GetAutoReply finds the best matching auto-reply for an incoming message
// Priority: channel+country match > channel match > country match > generic
func GetAutoReply(db *database.DB, ctx context.Context, orgID int64, channelType string, customerCountry string) string {
	rows, err := db.Pool.Query(ctx,
		`SELECT message, COALESCE(channel_type,''), COALESCE(country,'')
		 FROM auto_replies
		 WHERE org_id = $1 AND is_enabled = true
		 ORDER BY
		   CASE WHEN channel_type != '' AND country != '' THEN 1
		        WHEN channel_type != '' THEN 2
		        WHEN country != '' THEN 3
		        ELSE 4 END`,
		orgID)
	if err != nil {
		return ""
	}
	defer rows.Close()

	var genericMsg string
	for rows.Next() {
		var msg, chType, country string
		if err := rows.Scan(&msg, &chType, &country); err != nil {
			continue
		}

		chMatch := chType == "" || stringsEqualFold(chType, channelType)
		countryMatch := country == "" || stringsEqualFold(country, customerCountry)

		if chType != "" && country != "" && chMatch && countryMatch {
			return msg // Best: channel + country match
		}
		if chType != "" && country == "" && chMatch {
			return msg // Channel-specific
		}
		if chType == "" && country != "" && countryMatch {
			return msg // Country-specific
		}
		if chType == "" && country == "" && genericMsg == "" {
			genericMsg = msg // Generic fallback
		}
	}

	return genericMsg
}

func stringsEqualFold(a, b string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	// Simple case-insensitive comparison
	la := make([]byte, len(a))
	lb := make([]byte, len(b))
	for i := range a {
		if a[i] >= 'A' && a[i] <= 'Z' {
			la[i] = a[i] + 32
		} else {
			la[i] = a[i]
		}
	}
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			lb[i] = b[i] + 32
		} else {
			lb[i] = b[i]
		}
	}
	return string(la) == string(lb)
}
