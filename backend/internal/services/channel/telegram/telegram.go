package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Telegram Bot API.
type Provider struct {
	botToken string
}

// NewTelegramProvider creates a new Telegram provider from the given config map.
// Expected keys: "bot_token".
func NewTelegramProvider(config map[string]string) *Provider {
	return &Provider{
		botToken: config["bot_token"],
	}
}

func (p *Provider) GetType() string {
	return "telegram"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("tg_%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified Telegram Bot API Update structure.
type webhookPayload struct {
	UpdateID int `json:"update_id"`
	Message  struct {
		MessageID int `json:"message_id"`
		From      struct {
			ID        int64  `json:"id"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Username  string `json:"username"`
		} `json:"from"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
		Text     string `json:"text"`
		Document *struct {
			FileName string `json:"file_name"`
			FileID   string `json:"file_id"`
			FileSize int64  `json:"file_size"`
			MimeType string `json:"mime_type"`
		} `json:"document,omitempty"`
	} `json:"message"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("telegram: failed to parse webhook body: %w", err)
	}

	if payload.Message.MessageID == 0 {
		return nil, fmt.Errorf("telegram: no message in webhook payload")
	}

	from := payload.Message.From
	senderName := from.FirstName
	if from.LastName != "" {
		senderName += " " + from.LastName
	}

	msg := &channel.IncomingMessage{
		ExternalID:  strconv.Itoa(payload.Message.MessageID),
		SenderID:    strconv.FormatInt(from.ID, 10),
		SenderName:  senderName,
		Content:     payload.Message.Text,
		ContentType: "text",
	}

	if payload.Message.Document != nil {
		doc := payload.Message.Document
		msg.ContentType = "document"
		msg.Attachments = []channel.IncomingAttachment{
			{
				FileName: doc.FileName,
				FileURL:  doc.FileID, // would need to resolve via Telegram getFile API
				FileType: doc.MimeType,
				FileSize: doc.FileSize,
			},
		}
	}

	return msg, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	if creds["bot_token"] == "" {
		return fmt.Errorf("telegram: missing required credential: bot_token")
	}
	return nil
}
