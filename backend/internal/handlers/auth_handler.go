package handlers

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"net/smtp"
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
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Organization slug already exists"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		}
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

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
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
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer tx.Rollback(ctx)

	inviteToken := generateToken()
	tempHash, _ := h.auth.HashPassword("invite-" + inviteToken)
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

	var orgName string
	h.db.Pool.QueryRow(ctx, `SELECT name FROM organizations WHERE id = $1`, orgID).Scan(&orgName)

	go h.sendInviteEmail(req.Email, req.FullName, orgName, inviteToken)

	c.JSON(http.StatusCreated, gin.H{"message": "Davet gönderildi", "user_id": userID})
}

func (h *AuthHandler) sendInviteEmail(toEmail, fullName, orgName, token string) {
	ctx := context.Background()
	var creds string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(credentials::text, '{}') FROM channels WHERE type = 'email' LIMIT 1`,
	).Scan(&creds)
	if err != nil {
		return
	}

	smtpHost := "smtp.hostnet.nl"
	smtpPort := "587"
	smtpUser := "destek@lessandromance.com"
	smtpPass := ""
	fromAddr := "destek@lessandromance.com"

	if strings.Contains(creds, "smtp_host") {
		for _, part := range strings.Split(creds[1:len(creds)-1], ",") {
			kv := strings.SplitN(strings.TrimSpace(part), ":", 2)
			if len(kv) != 2 {
				continue
			}
			key := strings.Trim(strings.TrimSpace(kv[0]), "\"")
			val := strings.Trim(strings.TrimSpace(kv[1]), "\"")
			switch key {
			case "smtp_host":
				smtpHost = val
			case "smtp_port":
				smtpPort = val
			case "smtp_user":
				smtpUser = val
			case "smtp_password":
				smtpPass = val
			case "from_address":
				fromAddr = val
			}
		}
	}

	if smtpPass == "" {
		return
	}

	inviteURL := fmt.Sprintf("https://repliqsupport.com/accept-invite?token=%s&email=%s", token, toEmail)

	subject := fmt.Sprintf("%s ekibine davet edildiniz - Repliq", orgName)
	body := fmt.Sprintf("Merhaba %s,\r\n\r\n%s ekibine katilmaniz icin davet edildiniz.\r\n\r\nAsagidaki baglantiya tiklayarak sifrenizi belirleyip panele giris yapabilirsiniz:\r\n\r\n%s\r\n\r\nBu davet baglantisi 7 gun gecerlidir.\r\n\r\nIyi calismalar,\r\n%s Ekibi\r\nRepliq - repliqsupport.com",
		fullName, orgName, inviteURL, orgName)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\nDate: %s\r\n\r\n%s",
		fromAddr, toEmail, subject, time.Now().Format(time.RFC1123Z), body)

	addr := net.JoinHostPort(smtpHost, smtpPort)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return
	}

	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		conn.Close()
		return
	}
	defer client.Close()

	tlsConfig := &tls.Config{ServerName: smtpHost}
	client.StartTLS(tlsConfig)
	client.Auth(smtp.PlainAuth("", smtpUser, smtpPass, smtpHost))
	client.Mail(fromAddr)
	client.Rcpt(toEmail)
	w, err := client.Data()
	if err != nil {
		return
	}
	w.Write([]byte(msg))
	w.Close()
	client.Quit()
}

// AcceptInvite handles the invite acceptance - user sets their password
func (h *AuthHandler) AcceptInvite(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var userID int64
	var storedHash string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, password_hash FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &storedHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kullanici bulunamadi"})
		return
	}

	if !h.auth.CheckPassword("invite-"+req.Token, storedHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Gecersiz veya suresi dolmus davet baglantisi"})
		return
	}

	newHash, err := h.auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sifre olusturma hatasi"})
		return
	}

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		newHash, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sifre guncelleme hatasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sifreniz belirlendi. Artik giris yapabilirsiniz."})
}
