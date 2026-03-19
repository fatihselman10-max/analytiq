package twitter

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Twitter DM API.
type Provider struct {
	apiKey            string
	apiSecret         string
	accessToken       string
	accessTokenSecret string
	bearerToken       string
}

// NewTwitterProvider creates a new Twitter DM provider from the given config map.
// Expected keys: "api_key", "api_secret", "access_token", "access_token_secret", "bearer_token".
func NewTwitterProvider(config map[string]string) *Provider {
	return &Provider{
		apiKey:            config["api_key"],
		apiSecret:         config["api_secret"],
		accessToken:       config["access_token"],
		accessTokenSecret: config["access_token_secret"],
		bearerToken:       config["bearer_token"],
	}
}

func (p *Provider) GetType() string {
	return "twitter"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("tw_dm_%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified Twitter Account Activity API DM event.
type webhookPayload struct {
	DirectMessageEvents []struct {
		ID        string `json:"id"`
		Type      string `json:"type"`
		CreatedAt string `json:"created_timestamp"`
		Message   struct {
			SenderID string `json:"sender_id"`
			Target   struct {
				RecipientID string `json:"recipient_id"`
			} `json:"target"`
			Data struct {
				Text       string `json:"text"`
				Attachment *struct {
					Type  string `json:"type"`
					Media struct {
						URL string `json:"media_url_https"`
					} `json:"media"`
				} `json:"attachment,omitempty"`
			} `json:"message_data"`
		} `json:"message_create"`
	} `json:"direct_message_events"`
	Users map[string]struct {
		Name       string `json:"name"`
		ScreenName string `json:"screen_name"`
	} `json:"users"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("twitter: failed to parse webhook body: %w", err)
	}

	if len(payload.DirectMessageEvents) == 0 {
		return nil, fmt.Errorf("twitter: no DM events in webhook payload")
	}

	event := payload.DirectMessageEvents[0]
	senderID := event.Message.SenderID

	senderName := ""
	if user, ok := payload.Users[senderID]; ok {
		senderName = user.Name
	}

	msg := &channel.IncomingMessage{
		ExternalID:  event.ID,
		SenderID:    senderID,
		SenderName:  senderName,
		Content:     event.Message.Data.Text,
		ContentType: "text",
	}

	if event.Message.Data.Attachment != nil {
		att := event.Message.Data.Attachment
		msg.ContentType = att.Type
		msg.Attachments = []channel.IncomingAttachment{
			{
				FileURL:  att.Media.URL,
				FileType: att.Type,
			},
		}
	}

	return msg, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"api_key", "api_secret", "access_token", "access_token_secret"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("twitter: missing required credential: %s", key)
		}
	}
	return nil
}
