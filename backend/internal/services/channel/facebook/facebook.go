package facebook

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Facebook Messenger.
type Provider struct {
	pageID       string
	accessToken  string
	appSecret    string
	verifyToken  string
}

// NewFacebookProvider creates a new Facebook Messenger provider from the given config map.
// Expected keys: "page_id", "access_token", "app_secret", "verify_token".
func NewFacebookProvider(config map[string]string) *Provider {
	return &Provider{
		pageID:      config["page_id"],
		accessToken: config["access_token"],
		appSecret:   config["app_secret"],
		verifyToken: config["verify_token"],
	}
}

func (p *Provider) GetType() string {
	return "facebook"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("fb_mid.%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified Facebook Messenger webhook structure.
type webhookPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		ID        string `json:"id"`
		Time      int64  `json:"time"`
		Messaging []struct {
			Sender struct {
				ID string `json:"id"`
			} `json:"sender"`
			Recipient struct {
				ID string `json:"id"`
			} `json:"recipient"`
			Timestamp int64 `json:"timestamp"`
			Message   struct {
				MID         string `json:"mid"`
				Text        string `json:"text"`
				Attachments []struct {
					Type    string `json:"type"`
					Payload struct {
						URL string `json:"url"`
					} `json:"payload"`
				} `json:"attachments,omitempty"`
			} `json:"message"`
		} `json:"messaging"`
	} `json:"entry"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("facebook: failed to parse webhook body: %w", err)
	}

	if len(payload.Entry) == 0 || len(payload.Entry[0].Messaging) == 0 {
		return nil, fmt.Errorf("facebook: no messaging entries in webhook payload")
	}

	messaging := payload.Entry[0].Messaging[0]

	msg := &channel.IncomingMessage{
		ExternalID:  messaging.Message.MID,
		SenderID:    messaging.Sender.ID,
		SenderName:  "",
		Content:     messaging.Message.Text,
		ContentType: "text",
	}

	for _, att := range messaging.Message.Attachments {
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  att.Payload.URL,
			FileType: att.Type,
		})
	}

	if len(msg.Attachments) > 0 {
		msg.ContentType = "attachment"
	}

	return msg, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"page_id", "access_token", "app_secret"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("facebook: missing required credential: %s", key)
		}
	}
	return nil
}
