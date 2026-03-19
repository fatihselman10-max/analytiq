package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/repliq/backend/internal/auth"
	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	db   *database.DB
	auth *auth.Service
}

func NewAuthHandler(db *database.DB, authService *auth.Service) *AuthHandler {
	return &AuthHandler{db: db, auth: authService}
}

type RegisterRequest struct {
	Email            string `json:"email" binding:"required,email"`
	Password         string `json:"password" binding:"required,min=8"`
	FullName         string `json:"full_name" binding:"required"`
	OrganizationName string `json:"organization_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type InviteRequest struct {
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name" binding:"required"`
	Role     string `json:"role" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		ID       int64  `json:"id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	} `json:"user"`
	Organization struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
		Plan string `json:"plan"`
	} `json:"organization"`
	Role string `json:"role"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := h.auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback(ctx)

	// Create organization
	slug := strings.ToLower(strings.ReplaceAll(req.OrganizationName, " ", "-"))
	var orgID int64
	var orgPlan string
	err = tx.QueryRow(ctx,
		`INSERT INTO organizations (name, slug, plan) VALUES ($1, $2, 'free') RETURNING id, plan`,
		req.OrganizationName, slug,
	).Scan(&orgID, &orgPlan)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Organization slug already exists"})
		return
	}

	// Create user
	var userID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
		req.Email, hash, req.FullName,
	).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Create org member as owner
	_, err = tx.Exec(ctx,
		`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
		orgID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create membership"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit"})
		return
	}

	token, err := h.auth.GenerateToken(userID, req.Email, orgID, "owner")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := AuthResponse{Token: token, Role: "owner"}
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.FullName = req.FullName
	resp.Organization.ID = orgID
	resp.Organization.Name = req.OrganizationName
	resp.Organization.Slug = slug
	resp.Organization.Plan = orgPlan

	c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var userID int64
	var hash, fullName string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, password_hash, full_name FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &hash, &fullName)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !h.auth.CheckPassword(req.Password, hash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Get first org membership
	var orgID int64
	var orgName, orgSlug, orgPlan, role string
	err = h.db.Pool.QueryRow(ctx,
		`SELECT o.id, o.name, o.slug, o.plan, om.role
		 FROM org_members om
		 JOIN organizations o ON o.id = om.org_id
		 WHERE om.user_id = $1
		 ORDER BY om.created_at LIMIT 1`,
		userID,
	).Scan(&orgID, &orgName, &orgSlug, &orgPlan, &role)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No organization membership found"})
		return
	}

	token, err := h.auth.GenerateToken(userID, req.Email, orgID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := AuthResponse{Token: token, Role: role}
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.FullName = fullName
	resp.Organization.ID = orgID
	resp.Organization.Name = orgName
	resp.Organization.Slug = orgSlug
	resp.Organization.Plan = orgPlan

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) InviteMember(c *gin.Context) {
	var req InviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Role != "admin" && req.Role != "agent" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be admin or agent"})
		return
	}

	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback(ctx)

	// Create user with temporary password or find existing
	tempHash, _ := h.auth.HashPassword("temp-change-me")
	var userID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
		 RETURNING id`,
		req.Email, tempHash, req.FullName,
	).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Add to org
	_, err = tx.Exec(ctx,
		`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (org_id, user_id) DO UPDATE SET role = $3`,
		orgID, userID, req.Role,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Member invited", "user_id": userID})
}
