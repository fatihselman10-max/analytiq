package whatsapp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for WhatsApp Cloud API.
type Provider struct {
	phoneNumberID string
	accessToken   string
	webhookSecret string
}

// NewWhatsAppProvider creates a new WhatsApp provider from the given config map.
// Expected keys: "phone_number_id", "access_token", "webhook_secret".
func NewWhatsAppProvider(config map[string]string) *Provider {
	return &Provider{
		phoneNumberID: config["phone_number_id"],
		accessToken:   config["access_token"],
		webhookSecret: config["webhook_secret"],
	}
}

func (p *Provider) GetType() string {
	return "whatsapp"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	// Stub: generate a placeholder external ID.
	externalID := fmt.Sprintf("wamid.%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified WhatsApp Cloud API webhook structure.
type webhookPayload struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Messages []struct {
					ID   string `json:"id"`
					From string `json:"from"`
					Text struct {
						Body string `json:"body"`
					} `json:"text"`
					Type string `json:"type"`
				} `json:"messages"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("whatsapp: failed to parse webhook body: %w", err)
	}

	if len(payload.Entry) == 0 || len(payload.Entry[0].Changes) == 0 {
		return nil, fmt.Errorf("whatsapp: no entries in webhook payload")
	}

	value := payload.Entry[0].Changes[0].Value
	if len(value.Messages) == 0 {
		return nil, fmt.Errorf("whatsapp: no messages in webhook payload")
	}

	msg := value.Messages[0]
	senderName := ""
	if len(value.Contacts) > 0 {
		senderName = value.Contacts[0].Profile.Name
	}

	return &channel.IncomingMessage{
		ExternalID:  msg.ID,
		SenderID:    msg.From,
		SenderName:  senderName,
		Content:     msg.Text.Body,
		ContentType: msg.Type,
	}, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"phone_number_id", "access_token"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("whatsapp: missing required credential: %s", key)
		}
	}
	return nil
}
