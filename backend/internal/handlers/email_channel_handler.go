package handlers

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/repliq/backend/internal/database"
	channelpkg "github.com/repliq/backend/internal/services/channel"
	emailch "github.com/repliq/backend/internal/services/channel/email"
	imapclient "github.com/emersion/go-imap/client"
)

// EmailChannelHandler exposes a simple API for the settings UI to inspect, test
// and update the org's email channel without touching raw credentials JSON.
type EmailChannelHandler struct {
	db             *database.DB
	manager        *emailch.Manager
	channelService *channelpkg.Service
}

func NewEmailChannelHandler(db *database.DB, mgr *emailch.Manager, cs *channelpkg.Service) *EmailChannelHandler {
	return &EmailChannelHandler{db: db, manager: mgr, channelService: cs}
}

type emailChannelResponse struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	IsActive    bool   `json:"is_active"`
	Email       string `json:"email"`
	FromAddress string `json:"from_address"`
	SMTPHost    string `json:"smtp_host"`
	SMTPPort    string `json:"smtp_port"`
	IMAPHost    string `json:"imap_host"`
	IMAPPort    string `json:"imap_port"`
	HasPassword bool   `json:"has_password"`
}

// Get returns the current email channel (masked) or { configured: false }.
func (h *EmailChannelHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	var name string
	var isActive bool
	var credsStr string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, name, is_active, COALESCE(credentials::text,'{}')
		 FROM channels WHERE org_id = $1 AND type = 'email'
		 ORDER BY created_at ASC LIMIT 1`,
		orgID,
	).Scan(&id, &name, &isActive, &credsStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"configured": false})
		return
	}
	var creds map[string]string
	_ = json.Unmarshal([]byte(credsStr), &creds)
	resp := emailChannelResponse{
		ID:          id,
		Name:        name,
		IsActive:    isActive,
		Email:       creds["smtp_user"],
		FromAddress: creds["from_address"],
		SMTPHost:    creds["smtp_host"],
		SMTPPort:    creds["smtp_port"],
		IMAPHost:    creds["imap_host"],
		IMAPPort:    creds["imap_port"],
		HasPassword: creds["smtp_password"] != "",
	}
	c.JSON(http.StatusOK, gin.H{"configured": true, "channel": resp})
}

type emailCredentialsPayload struct {
	Name        string `json:"name"`
	Email       string `json:"email" binding:"required"`
	AppPassword string `json:"app_password" binding:"required"`
	SMTPHost    string `json:"smtp_host"`
	SMTPPort    string `json:"smtp_port"`
	IMAPHost    string `json:"imap_host"`
	IMAPPort    string `json:"imap_port"`
	FromAddress string `json:"from_address"`
}

func (p *emailCredentialsPayload) normalized() map[string]string {
	smtpHost := strings.TrimSpace(p.SMTPHost)
	smtpPort := strings.TrimSpace(p.SMTPPort)
	imapHost := strings.TrimSpace(p.IMAPHost)
	imapPort := strings.TrimSpace(p.IMAPPort)
	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
	}
	if smtpPort == "" {
		smtpPort = "587"
	}
	if imapHost == "" {
		imapHost = "imap.gmail.com"
	}
	if imapPort == "" {
		imapPort = "993"
	}
	from := strings.TrimSpace(p.FromAddress)
	if from == "" {
		from = strings.TrimSpace(p.Email)
	}
	// Gmail App Passwords are printed with spaces; strip them so auth works.
	pass := strings.ReplaceAll(strings.TrimSpace(p.AppPassword), " ", "")
	return map[string]string{
		"smtp_host":     smtpHost,
		"smtp_port":     smtpPort,
		"smtp_user":     strings.TrimSpace(p.Email),
		"smtp_password": pass,
		"imap_host":     imapHost,
		"imap_port":     imapPort,
		"from_address":  from,
	}
}

// Test attempts both SMTP AUTH and IMAP LOGIN against the supplied credentials.
// It does NOT touch the DB. Returns a structured result the UI can surface.
func (h *EmailChannelHandler) Test(c *gin.Context) {
	var req emailCredentialsPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	creds := req.normalized()
	smtpOK, smtpErr := testSMTP(creds)
	imapOK, imapErr := testIMAP(creds)
	resp := gin.H{
		"smtp_ok": smtpOK,
		"imap_ok": imapOK,
	}
	if smtpErr != nil {
		resp["smtp_error"] = smtpErr.Error()
	}
	if imapErr != nil {
		resp["imap_error"] = imapErr.Error()
	}
	resp["ok"] = smtpOK && imapOK
	c.JSON(http.StatusOK, resp)
}

// Save validates credentials, upserts the email channel row, and refreshes the
// IMAP poller so new settings take effect without a backend restart.
func (h *EmailChannelHandler) Save(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req emailCredentialsPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	creds := req.normalized()

	if smtpOK, err := testSMTP(creds); !smtpOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP auth failed", "detail": errString(err)})
		return
	}
	if imapOK, err := testIMAP(creds); !imapOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IMAP auth failed", "detail": errString(err)})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Email"
	}
	credsJSON, _ := json.Marshal(creds)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id FROM channels WHERE org_id = $1 AND type = 'email' ORDER BY created_at ASC LIMIT 1`,
		orgID,
	).Scan(&id)
	if err != nil {
		if err := h.db.Pool.QueryRow(ctx,
			`INSERT INTO channels (org_id, type, name, credentials, is_active, created_at, updated_at)
			 VALUES ($1, 'email', $2, $3::jsonb, true, NOW(), NOW())
			 RETURNING id`,
			orgID, name, string(credsJSON),
		).Scan(&id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel", "detail": err.Error()})
			return
		}
	} else {
		if _, err := h.db.Pool.Exec(ctx,
			`UPDATE channels SET name = $1, credentials = $2::jsonb, is_active = true, updated_at = NOW()
			 WHERE id = $3`,
			name, string(credsJSON), id,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update channel", "detail": err.Error()})
			return
		}
	}

	if h.manager != nil {
		if err := h.manager.Refresh(ctx, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Channel saved but poller refresh failed", "detail": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"id": id, "ok": true})
}

// Disconnect turns the channel off, stops the poller, but keeps the DB row so
// the agent can re-enable later without re-entering the password.
func (h *EmailChannelHandler) Disconnect(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id FROM channels WHERE org_id = $1 AND type = 'email' ORDER BY created_at ASC LIMIT 1`,
		orgID,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No email channel"})
		return
	}
	if _, err := h.db.Pool.Exec(ctx,
		`UPDATE channels SET is_active = false, updated_at = NOW() WHERE id = $1`, id,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disconnect"})
		return
	}
	if h.manager != nil {
		h.manager.Remove(id)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func testSMTP(creds map[string]string) (bool, error) {
	addr := net.JoinHostPort(creds["smtp_host"], creds["smtp_port"])
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return false, fmt.Errorf("dial: %w", err)
	}
	client, err := smtp.NewClient(conn, creds["smtp_host"])
	if err != nil {
		return false, fmt.Errorf("client: %w", err)
	}
	defer client.Close()
	if err := client.StartTLS(&tls.Config{ServerName: creds["smtp_host"]}); err != nil {
		return false, fmt.Errorf("starttls: %w", err)
	}
	auth := smtp.PlainAuth("", creds["smtp_user"], creds["smtp_password"], creds["smtp_host"])
	if err := client.Auth(auth); err != nil {
		return false, fmt.Errorf("auth: %w", err)
	}
	_ = client.Quit()
	return true, nil
}

func testIMAP(creds map[string]string) (bool, error) {
	addr := net.JoinHostPort(creds["imap_host"], creds["imap_port"])
	c, err := imapclient.DialTLS(addr, nil)
	if err != nil {
		return false, fmt.Errorf("dial: %w", err)
	}
	defer c.Logout()
	if err := c.Login(creds["smtp_user"], creds["smtp_password"]); err != nil {
		return false, fmt.Errorf("login: %w", err)
	}
	return true, nil
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// Compose creates a brand-new outbound email thread. Accepts multipart/form-data
// with fields to_email, subject, body, optional to_name, and zero-or-more file
// parts named "files". Sends via SMTP, persists conversation+message+attachments,
// and returns the new conversation_id so the UI can navigate to it.
func (h *EmailChannelHandler) Compose(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")

	if err := c.Request.ParseMultipartForm(20 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form data"})
		return
	}
	toEmail := strings.TrimSpace(c.PostForm("to_email"))
	toName := strings.TrimSpace(c.PostForm("to_name"))
	subject := strings.TrimSpace(c.PostForm("subject"))
	body := c.PostForm("body")
	if toEmail == "" || subject == "" || body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_email, subject, and body are required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var channelID int64
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id FROM channels WHERE org_id = $1 AND type = 'email' AND is_active = true
		 ORDER BY created_at ASC LIMIT 1`,
		orgID,
	).Scan(&channelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email channel is not configured"})
		return
	}

	var attachments []channelpkg.IncomingAttachment
	if form := c.Request.MultipartForm; form != nil {
		for _, fh := range form.File["files"] {
			if fh.Size > 10*1024*1024 {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("%s > 10MB", fh.Filename)})
				return
			}
			f, err := fh.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(f)
			f.Close()
			if err != nil {
				continue
			}
			ctype := fh.Header.Get("Content-Type")
			if ctype == "" {
				ctype = "application/octet-stream"
			}
			attachments = append(attachments, channelpkg.IncomingAttachment{
				FileName: fh.Filename,
				FileType: ctype,
				FileSize: fh.Size,
				Data:     data,
			})
		}
	}

	result, err := h.channelService.StartEmailConversation(ctx, channelID, userID, toEmail, toName, subject, body, attachments)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"conversation_id": result.ConversationID,
		"message_id":      result.MessageID,
		"contact_id":      result.ContactID,
	})
}
