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

type ContactHandler struct {
	db *database.DB
}

func NewContactHandler(db *database.DB) *ContactHandler {
	return &ContactHandler{db: db}
}

func (h *ContactHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := `SELECT id, org_id, external_id, channel_type, name, email, phone, avatar_url, created_at, updated_at
	          FROM contacts WHERE org_id = $1`
	args := []interface{}{orgID}

	if search := c.Query("search"); search != "" {
		query += ` AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)`
		args = append(args, "%"+search+"%")
	}

	query += ` ORDER BY updated_at DESC LIMIT 100`

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch contacts"})
		return
	}
	defer rows.Close()

	contacts := []models.Contact{}
	for rows.Next() {
		var ct models.Contact
		if err := rows.Scan(&ct.ID, &ct.OrgID, &ct.ExternalID, &ct.ChannelType, &ct.Name, &ct.Email, &ct.Phone, &ct.AvatarURL, &ct.CreatedAt, &ct.UpdatedAt); err == nil {
			contacts = append(contacts, ct)
		}
	}

	c.JSON(http.StatusOK, gin.H{"contacts": contacts})
}

func (h *ContactHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var ct models.Contact
	err = h.db.Pool.QueryRow(ctx,
		`SELECT id, org_id, external_id, channel_type, name, email, phone, avatar_url, created_at, updated_at
		 FROM contacts WHERE id = $1 AND org_id = $2`, id, orgID,
	).Scan(&ct.ID, &ct.OrgID, &ct.ExternalID, &ct.ChannelType, &ct.Name, &ct.Email, &ct.Phone, &ct.AvatarURL, &ct.CreatedAt, &ct.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}

	c.JSON(http.StatusOK, ct)
}

func (h *ContactHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name  *string `json:"name"`
		Email *string `json:"email"`
		Phone *string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Name != nil {
		h.db.Pool.Exec(ctx, `UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, *req.Name, id, orgID)
	}
	if req.Email != nil {
		h.db.Pool.Exec(ctx, `UPDATE contacts SET email = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, *req.Email, id, orgID)
	}
	if req.Phone != nil {
		h.db.Pool.Exec(ctx, `UPDATE contacts SET phone = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`, *req.Phone, id, orgID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}
