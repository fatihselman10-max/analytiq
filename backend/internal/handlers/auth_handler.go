package handlers

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
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

	// Parse SMTP credentials from JSON
	type smtpCreds struct {
		Host     string `json:"smtp_host"`
		Port     string `json:"smtp_port"`
		User     string `json:"smtp_user"`
		Password string `json:"smtp_password"`
		From     string `json:"from_address"`
	}
	var sc smtpCreds
	if err := json.Unmarshal([]byte(creds), &sc); err != nil {
		return
	}
	smtpHost := sc.Host
	smtpPort := sc.Port
	smtpUser := sc.User
	smtpPass := sc.Password
	fromAddr := sc.From
	if fromAddr == "" {
		fromAddr = smtpUser
	}
	if smtpPass == "" || smtpHost == "" {
		return
	}

	inviteURL := fmt.Sprintf("https://repliqsupport.com/accept-invite?token=%s&email=%s", token, toEmail)

	subject := fmt.Sprintf("%s ekibine davet edildiniz", orgName)
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<tr><td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px;text-align:center;">
<div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
<span style="color:white;font-size:24px;font-weight:bold;">R</span>
</div>
<h1 style="color:white;margin:0;font-size:22px;font-weight:700;">Repliq</h1>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Merhaba %s,</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
<strong style="color:#1e293b;">%s</strong> ekibine katilmaniz icin davet edildiniz. Asagidaki butona tiklayarak sifrenizi belirleyip hemen panele erisebilirsiniz.
</p>
<table width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="%s" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(59,130,246,0.3);">
Daveti Kabul Et
</a>
</td></tr></table>
<div style="margin-top:24px;padding:16px;background-color:#f1f5f9;border-radius:10px;">
<p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Buton calismiyorsa bu linki kopyalayin:</p>
<p style="color:#3b82f6;font-size:11px;word-break:break-all;margin:0;">%s</p>
</div>
<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;text-align:center;">
Bu davet 7 gun gecerlidir. Siz talep etmediyseniz bu maili gormezden gelebilirsiniz.
</p>
</td></tr>
<tr><td style="padding:20px 32px;background-color:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:11px;margin:0;">Repliq - Musteri Iletisim Platformu</p>
<p style="color:#cbd5e1;font-size:11px;margin:4px 0 0;">repliqsupport.com</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`, fullName, orgName, inviteURL, inviteURL)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"utf-8\"\r\nDate: %s\r\n\r\n%s",
		fromAddr, toEmail, subject, time.Now().Format(time.RFC1123Z), htmlBody)

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
