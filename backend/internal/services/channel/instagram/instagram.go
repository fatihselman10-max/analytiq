package instagram

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Instagram Messaging API.
type Provider struct {
	pageID      string
	accessToken string
	appSecret   string
}

// NewInstagramProvider creates a new Instagram provider from the given config map.
// Expected keys: "page_id", "access_token", "app_secret".
func NewInstagramProvider(config map[string]string) *Provider {
	return &Provider{
		pageID:      config["page_id"],
		accessToken: config["access_token"],
		appSecret:   config["app_secret"],
	}
}

func (p *Provider) GetType() string {
	return "instagram"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("ig_mid.%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified Instagram Messaging webhook structure.
type webhookPayload struct {
	Entry []struct {
		ID        string `json:"id"`
		Messaging []struct {
			Sender struct {
				ID string `json:"id"`
			} `json:"sender"`
			Recipient struct {
				ID string `json:"id"`
			} `json:"recipient"`
			Timestamp int64 `json:"timestamp"`
			Message   struct {
				MID  string `json:"mid"`
				Text string `json:"text"`
			} `json:"message"`
		} `json:"messaging"`
	} `json:"entry"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("instagram: failed to parse webhook body: %w", err)
	}

	if len(payload.Entry) == 0 || len(payload.Entry[0].Messaging) == 0 {
		return nil, fmt.Errorf("instagram: no messaging entries in webhook payload")
	}

	messaging := payload.Entry[0].Messaging[0]

	return &channel.IncomingMessage{
		ExternalID:  messaging.Message.MID,
		SenderID:    messaging.Sender.ID,
		SenderName:  "",
		Content:     messaging.Message.Text,
		ContentType: "text",
	}, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"page_id", "access_token"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("instagram: missing required credential: %s", key)
		}
	}
	return nil
}
