package email

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/repliq/backend/internal/services/channel"
)

type Provider struct {
	smtpHost     string
	smtpPort     string
	smtpUser     string
	smtpPassword string
	imapHost     string
	imapPort     string
	fromAddress  string
}

func NewEmailProvider(config map[string]string) *Provider {
	from := config["from_address"]
	if from == "" {
		from = config["smtp_user"]
	}
	return &Provider{
		smtpHost:     config["smtp_host"],
		smtpPort:     config["smtp_port"],
		smtpUser:     config["smtp_user"],
		smtpPassword: config["smtp_password"],
		imapHost:     config["imap_host"],
		imapPort:     config["imap_port"],
		fromAddress:  from,
	}
}

func (p *Provider) GetType() string {
	return "email"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	toEmail := contactExternalID

	subject := "Re: Destek Talebi"

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\nDate: %s\r\n\r\n%s",
		p.fromAddress, toEmail, subject, time.Now().Format(time.RFC1123Z), content)

	addr := net.JoinHostPort(p.smtpHost, p.smtpPort)

	// Connect with STARTTLS
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return "", fmt.Errorf("email: failed to connect to SMTP: %w", err)
	}

	client, err := smtp.NewClient(conn, p.smtpHost)
	if err != nil {
		return "", fmt.Errorf("email: failed to create SMTP client: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{ServerName: p.smtpHost}
	if err = client.StartTLS(tlsConfig); err != nil {
		return "", fmt.Errorf("email: STARTTLS failed: %w", err)
	}

	auth := smtp.PlainAuth("", p.smtpUser, p.smtpPassword, p.smtpHost)
	if err = client.Auth(auth); err != nil {
		return "", fmt.Errorf("email: auth failed: %w", err)
	}

	if err = client.Mail(p.fromAddress); err != nil {
		return "", fmt.Errorf("email: MAIL FROM failed: %w", err)
	}
	if err = client.Rcpt(toEmail); err != nil {
		return "", fmt.Errorf("email: RCPT TO failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return "", fmt.Errorf("email: DATA failed: %w", err)
	}
	_, err = w.Write([]byte(msg))
	if err != nil {
		return "", fmt.Errorf("email: write body failed: %w", err)
	}
	err = w.Close()
	if err != nil {
		return "", fmt.Errorf("email: close body failed: %w", err)
	}

	client.Quit()

	externalID := fmt.Sprintf("email_sent_%s_%d", toEmail, time.Now().UnixNano())
	return externalID, nil
}

type webhookPayload struct {
	MessageID string `json:"message_id"`
	From      string `json:"from"`
	FromName  string `json:"from_name"`
	To        string `json:"to"`
	Subject   string `json:"subject"`
	TextBody  string `json:"text_body"`
	HTMLBody  string `json:"html_body"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("email: failed to parse webhook: %w", err)
	}

	content := payload.TextBody
	if content == "" {
		content = payload.HTMLBody
	}
	if content == "" {
		content = payload.Subject
	}

	senderName := payload.FromName
	if senderName == "" {
		senderName = extractNameFromEmail(payload.From)
	}

	return &channel.IncomingMessage{
		ExternalID:  payload.MessageID,
		SenderID:    payload.From,
		SenderName:  senderName,
		Content:     content,
		ContentType: "text",
	}, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"smtp_host", "smtp_port", "smtp_user", "smtp_password"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("email: missing required credential: %s", key)
		}
	}
	return nil
}

func extractNameFromEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) > 0 {
		return parts[0]
	}
	return email
}
