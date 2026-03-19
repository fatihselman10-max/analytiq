package livechat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for a LiveChat WebSocket widget.
type Provider struct {
	widgetID  string
	apiKey    string
	origin    string
}

// NewLiveChatProvider creates a new LiveChat provider from the given config map.
// Expected keys: "widget_id", "api_key", "origin".
func NewLiveChatProvider(config map[string]string) *Provider {
	return &Provider{
		widgetID: config["widget_id"],
		apiKey:   config["api_key"],
		origin:   config["origin"],
	}
}

func (p *Provider) GetType() string {
	return "livechat"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("lc_msg_%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a LiveChat widget message event sent over WebSocket
// or via HTTP callback.
type webhookPayload struct {
	Event string `json:"event"`
	Data  struct {
		MessageID  string `json:"message_id"`
		SessionID  string `json:"session_id"`
		VisitorID  string `json:"visitor_id"`
		VisitorName string `json:"visitor_name"`
		Content    string `json:"content"`
		Type       string `json:"type"`
		Attachments []struct {
			FileName string `json:"file_name"`
			FileURL  string `json:"file_url"`
			FileType string `json:"file_type"`
			FileSize int64  `json:"file_size"`
		} `json:"attachments,omitempty"`
	} `json:"data"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("livechat: failed to parse webhook body: %w", err)
	}

	if payload.Event != "message" && payload.Event != "new_message" {
		return nil, fmt.Errorf("livechat: unsupported event type: %s", payload.Event)
	}

	data := payload.Data
	if data.MessageID == "" {
		return nil, fmt.Errorf("livechat: missing message_id in webhook payload")
	}

	contentType := data.Type
	if contentType == "" {
		contentType = "text"
	}

	msg := &channel.IncomingMessage{
		ExternalID:  data.MessageID,
		SenderID:    data.VisitorID,
		SenderName:  data.VisitorName,
		Content:     data.Content,
		ContentType: contentType,
	}

	for _, att := range data.Attachments {
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: att.FileName,
			FileURL:  att.FileURL,
			FileType: att.FileType,
			FileSize: att.FileSize,
		})
	}

	return msg, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"widget_id", "api_key"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("livechat: missing required credential: %s", key)
		}
	}
	return nil
}
