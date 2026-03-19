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

type CannedHandler struct {
	db *database.DB
}

func NewCannedHandler(db *database.DB) *CannedHandler {
	return &CannedHandler{db: db}
}

func (h *CannedHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, org_id, shortcut, title, content, created_at, updated_at
		 FROM canned_responses WHERE org_id = $1 ORDER BY shortcut`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	items := []models.CannedResponse{}
	for rows.Next() {
		var cr models.CannedResponse
		if err := rows.Scan(&cr.ID, &cr.OrgID, &cr.Shortcut, &cr.Title, &cr.Content, &cr.CreatedAt, &cr.UpdatedAt); err == nil {
			items = append(items, cr)
		}
	}

	c.JSON(http.StatusOK, gin.H{"canned_responses": items})
}

func (h *CannedHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Shortcut string `json:"shortcut" binding:"required"`
		Title    string `json:"title" binding:"required"`
		Content  string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO canned_responses (org_id, shortcut, title, content)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		orgID, req.Shortcut, req.Title, req.Content,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Shortcut already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *CannedHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Shortcut string `json:"shortcut"`
		Title    string `json:"title"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE canned_responses SET shortcut = COALESCE(NULLIF($1, ''), shortcut),
		 title = COALESCE(NULLIF($2, ''), title),
		 content = COALESCE(NULLIF($3, ''), content),
		 updated_at = NOW()
		 WHERE id = $4 AND org_id = $5`,
		req.Shortcut, req.Title, req.Content, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *CannedHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`DELETE FROM canned_responses WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
