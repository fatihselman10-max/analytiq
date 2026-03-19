package email

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for SMTP/IMAP email.
type Provider struct {
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	imapHost     string
	imapPort     string
	fromAddress  string
}

// NewEmailProvider creates a new email provider from the given config map.
// Expected keys: "smtp_host", "smtp_port", "smtp_username", "smtp_password",
// "imap_host", "imap_port", "from_address".
func NewEmailProvider(config map[string]string) *Provider {
	return &Provider{
		smtpHost:     config["smtp_host"],
		smtpPort:     config["smtp_port"],
		smtpUsername: config["smtp_username"],
		smtpPassword: config["smtp_password"],
		imapHost:     config["imap_host"],
		imapPort:     config["imap_port"],
		fromAddress:  config["from_address"],
	}
}

func (p *Provider) GetType() string {
	return "email"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("email_%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents an inbound email parsed into a normalized structure
// (e.g., from an inbound email parsing service like SendGrid Inbound Parse or Mailgun).
type webhookPayload struct {
	MessageID   string `json:"message_id"`
	From        string `json:"from"`
	FromName    string `json:"from_name"`
	To          string `json:"to"`
	Subject     string `json:"subject"`
	TextBody    string `json:"text_body"`
	HTMLBody    string `json:"html_body"`
	Attachments []struct {
		FileName    string `json:"file_name"`
		ContentType string `json:"content_type"`
		URL         string `json:"url"`
		Size        int64  `json:"size"`
	} `json:"attachments"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("email: failed to parse webhook body: %w", err)
	}

	if payload.MessageID == "" {
		return nil, fmt.Errorf("email: missing message_id in webhook payload")
	}

	content := payload.TextBody
	contentType := "text"
	if content == "" && payload.HTMLBody != "" {
		content = payload.HTMLBody
		contentType = "html"
	}

	msg := &channel.IncomingMessage{
		ExternalID:  payload.MessageID,
		SenderID:    payload.From,
		SenderName:  payload.FromName,
		Content:     content,
		ContentType: contentType,
	}

	for _, att := range payload.Attachments {
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: att.FileName,
			FileURL:  att.URL,
			FileType: att.ContentType,
			FileSize: att.Size,
		})
	}

	return msg, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"smtp_host", "smtp_port", "smtp_username", "smtp_password", "from_address"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("email: missing required credential: %s", key)
		}
	}
	return nil
}
