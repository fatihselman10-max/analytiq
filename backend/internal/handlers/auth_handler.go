package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/auth"
	"github.com/analytiq/backend/internal/database"
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
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name" binding:"required"`
	Company  string `json:"company"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		ID       int64  `json:"id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
		Company  string `json:"company"`
		Plan     string `json:"plan"`
	} `json:"user"`
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

	var userID int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name, company)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		req.Email, hash, req.FullName, req.Company,
	).Scan(&userID)

	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	token, err := h.auth.GenerateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := AuthResponse{Token: token}
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.FullName = req.FullName
	resp.User.Company = req.Company
	resp.User.Plan = "free"

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
	var hash, fullName, company, plan string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, password_hash, full_name, company, plan FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &hash, &fullName, &company, &plan)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !h.auth.CheckPassword(req.Password, hash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := h.auth.GenerateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := AuthResponse{Token: token}
	resp.User.ID = userID
	resp.User.Email = req.Email
	resp.User.FullName = fullName
	resp.User.Company = company
	resp.User.Plan = plan

	c.JSON(http.StatusOK, resp)
}
