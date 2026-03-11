package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type IntegrationHandler struct {
	db *database.DB
}

func NewIntegrationHandler(db *database.DB) *IntegrationHandler {
	return &IntegrationHandler{db: db}
}

type CreateIntegrationRequest struct {
	Platform     string            `json:"platform" binding:"required"`
	PlatformType string            `json:"platform_type" binding:"required"`
	Credentials  map[string]string `json:"credentials" binding:"required"`
}

type IntegrationResponse struct {
	ID           int64     `json:"id"`
	Platform     string    `json:"platform"`
	PlatformType string    `json:"platform_type"`
	Status       string    `json:"status"`
	LastSyncAt   *string   `json:"last_sync_at"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *IntegrationHandler) ListIntegrations(c *gin.Context) {
	userID := c.GetInt64("user_id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, platform, platform_type, status, last_sync_at, created_at
		 FROM integrations WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch integrations"})
		return
	}
	defer rows.Close()

	var integrations []IntegrationResponse
	for rows.Next() {
		var i IntegrationResponse
		var lastSync *time.Time
		if err := rows.Scan(&i.ID, &i.Platform, &i.PlatformType, &i.Status, &lastSync, &i.CreatedAt); err == nil {
			if lastSync != nil {
				s := lastSync.Format("2006-01-02 15:04:05")
				i.LastSyncAt = &s
			}
			integrations = append(integrations, i)
		}
	}

	c.JSON(http.StatusOK, gin.H{"integrations": integrations})
}

func (h *IntegrationHandler) CreateIntegration(c *gin.Context) {
	userID := c.GetInt64("user_id")

	var req CreateIntegrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate platform
	validPlatforms := map[string]string{
		// Marketplaces
		"trendyol": "marketplace", "hepsiburada": "marketplace",
		"n11": "marketplace", "amazon": "marketplace",
		"ciceksepeti": "marketplace",
		// E-commerce
		"shopify": "ecommerce", "woocommerce": "ecommerce",
		"ticimax": "ecommerce", "ideasoft": "ecommerce",
		"tsoft": "ecommerce", "ikas": "ecommerce",
		// Advertising
		"meta": "advertising", "google": "advertising",
		"tiktok": "advertising",
	}

	expectedType, ok := validPlatforms[req.Platform]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid platform"})
		return
	}
	if req.PlatformType != expectedType {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Platform type mismatch"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// TODO: encrypt credentials before storing
	credJSON := "{}" // placeholder - implement encryption

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO integrations (user_id, platform, platform_type, credentials, status)
		 VALUES ($1, $2, $3, $4, 'active')
		 ON CONFLICT (user_id, platform) DO UPDATE SET credentials = $4, status = 'active', updated_at = NOW()
		 RETURNING id`,
		userID, req.Platform, req.PlatformType, credJSON,
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create integration"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":       id,
		"platform": req.Platform,
		"status":   "active",
		"message":  "Integration created. Initial sync will begin shortly.",
	})
}

func (h *IntegrationHandler) DeleteIntegration(c *gin.Context) {
	userID := c.GetInt64("user_id")
	integrationID := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	result, err := h.db.Pool.Exec(ctx,
		`DELETE FROM integrations WHERE id = $1 AND user_id = $2`,
		integrationID, userID,
	)
	if err != nil || result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Integration deleted"})
}

func (h *IntegrationHandler) SyncIntegration(c *gin.Context) {
	userID := c.GetInt64("user_id")
	integrationID := c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var platform, platformType string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT platform, platform_type FROM integrations WHERE id = $1 AND user_id = $2`,
		integrationID, userID,
	).Scan(&platform, &platformType)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	// TODO: trigger async sync job via message queue
	c.JSON(http.StatusAccepted, gin.H{
		"message":  "Sync initiated",
		"platform": platform,
	})
}
