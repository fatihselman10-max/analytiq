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

type ChannelHandler struct {
	db *database.DB
}

func NewChannelHandler(db *database.DB) *ChannelHandler {
	return &ChannelHandler{db: db}
}

func (h *ChannelHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, org_id, type, name, is_active, created_at, updated_at
		 FROM channels WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channels"})
		return
	}
	defer rows.Close()

	channels := []models.Channel{}
	for rows.Next() {
		var ch models.Channel
		if err := rows.Scan(&ch.ID, &ch.OrgID, &ch.Type, &ch.Name, &ch.IsActive, &ch.CreatedAt, &ch.UpdatedAt); err == nil {
			channels = append(channels, ch)
		}
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

func (h *ChannelHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Type        string            `json:"type" binding:"required"`
		Name        string            `json:"name" binding:"required"`
		Credentials map[string]string `json:"credentials"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO channels (org_id, type, name, credentials)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		orgID, req.Type, req.Name, req.Credentials,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *ChannelHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name        *string           `json:"name"`
		IsActive    *bool             `json:"is_active"`
		Credentials map[string]string `json:"credentials"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Name != nil {
		h.db.Pool.Exec(ctx, `UPDATE channels SET name = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, *req.Name, id, orgID)
	}
	if req.IsActive != nil {
		h.db.Pool.Exec(ctx, `UPDATE channels SET is_active = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, *req.IsActive, id, orgID)
	}
	if req.Credentials != nil {
		h.db.Pool.Exec(ctx, `UPDATE channels SET credentials = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, req.Credentials, id, orgID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *ChannelHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx, `DELETE FROM channels WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete channel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
