package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type TeamHandler struct {
	db *database.DB
}

func NewTeamHandler(db *database.DB) *TeamHandler {
	return &TeamHandler{db: db}
}

type TeamMember struct {
	UserID    int64  `json:"user_id"`
	Email     string `json:"email"`
	FullName  string `json:"full_name"`
	AvatarURL string `json:"avatar_url"`
	Role      string `json:"role"`
}

func (h *TeamHandler) ListMembers(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT u.id, u.email, u.full_name, COALESCE(u.avatar_url, ''), om.role
		 FROM org_members om
		 JOIN users u ON u.id = om.user_id
		 WHERE om.org_id = $1
		 ORDER BY om.created_at`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}
	defer rows.Close()

	members := []TeamMember{}
	for rows.Next() {
		var m TeamMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.FullName, &m.AvatarURL, &m.Role); err == nil {
			members = append(members, m)
		}
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *TeamHandler) UpdateMember(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Role != "admin" && req.Role != "agent" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be admin or agent"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE org_members SET role = $1 WHERE org_id = $2 AND user_id = $3 AND role != 'owner'`,
		req.Role, orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *TeamHandler) DeleteMember(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Don't allow removing owner
	var role string
	h.db.Pool.QueryRow(ctx, `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`, orgID, userID).Scan(&role)
	if role == "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove owner"})
		return
	}

	_, err = h.db.Pool.Exec(ctx,
		`DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`, orgID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Removed"})
}

func (h *TeamHandler) GetOrganization(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var name, slug, plan string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT name, slug, plan FROM organizations WHERE id = $1`, orgID,
	).Scan(&name, &slug, &plan)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": orgID, "name": name, "slug": slug, "plan": plan})
}

func (h *TeamHandler) UpdateOrganization(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Name *string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Name != nil {
		_, err := h.db.Pool.Exec(ctx,
			`UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2`,
			*req.Name, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}
