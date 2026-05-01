package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/services/channel"
)

const graphAPIVersion = "v21.0"

// Provider implements the channel.Provider interface for WhatsApp Cloud API.
type Provider struct {
	phoneNumberID string
	accessToken   string
	webhookSecret string
	httpClient    *http.Client
}

// NewWhatsAppProvider creates a new WhatsApp provider from the given config map.
// Expected keys: "phone_number_id", "access_token", "webhook_secret".
func NewWhatsAppProvider(config map[string]string) *Provider {
	return &Provider{
		phoneNumberID: config["phone_number_id"],
		accessToken:   config["access_token"],
		webhookSecret: config["webhook_secret"],
		httpClient:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *Provider) GetType() string {
	return "whatsapp"
}

// ExtractPhoneNumberID parses a webhook body and returns the recipient phone_number_id
// without requiring credentials. Used by the webhook handler to route incoming messages
// to the correct tenant's channel before constructing a provider.
func ExtractPhoneNumberID(body []byte) (string, error) {
	var peek struct {
		Entry []struct {
			Changes []struct {
				Value struct {
					Metadata struct {
						PhoneNumberID      string `json:"phone_number_id"`
						DisplayPhoneNumber string `json:"display_phone_number"`
					} `json:"metadata"`
				} `json:"value"`
			} `json:"changes"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &peek); err != nil {
		return "", fmt.Errorf("whatsapp: invalid webhook json: %w", err)
	}
	if len(peek.Entry) == 0 || len(peek.Entry[0].Changes) == 0 {
		return "", fmt.Errorf("whatsapp: no entry/changes in webhook payload")
	}
	id := peek.Entry[0].Changes[0].Value.Metadata.PhoneNumberID
	if id == "" {
		return "", fmt.Errorf("whatsapp: webhook missing metadata.phone_number_id")
	}
	return id, nil
}

func (p *Provider) SendMessage(ctx context.Context, recipient string, content string, attachments []channel.IncomingAttachment) (string, error) {
	if p.phoneNumberID == "" || p.accessToken == "" {
		return "", fmt.Errorf("whatsapp: provider missing phone_number_id or access_token")
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                recipient,
		"type":              "text",
		"text": map[string]interface{}{
			"preview_url": false,
			"body":        content,
		},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("whatsapp: marshal send payload: %w", err)
	}

	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", graphAPIVersion, p.phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("whatsapp: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("whatsapp: send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("whatsapp: send failed status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("whatsapp: parse send response: %w (body=%s)", err, string(respBody))
	}
	if len(result.Messages) == 0 {
		return "", fmt.Errorf("whatsapp: send response has no messages: %s", string(respBody))
	}
	return result.Messages[0].ID, nil
}

// webhookPayload represents a simplified WhatsApp Cloud API webhook structure.
type webhookPayload struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Metadata struct {
					PhoneNumberID      string `json:"phone_number_id"`
					DisplayPhoneNumber string `json:"display_phone_number"`
				} `json:"metadata"`
				Messages []struct {
					ID        string `json:"id"`
					From      string `json:"from"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      struct {
						Body string `json:"body"`
					} `json:"text"`
				} `json:"messages"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
				Statuses []struct {
					ID          string `json:"id"`
					Status      string `json:"status"`
					RecipientID string `json:"recipient_id"`
				} `json:"statuses"`
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

	// Status callback (delivered/read/failed) — not a new message, treat as benign no-op
	if len(value.Messages) == 0 && len(value.Statuses) > 0 {
		return &channel.IncomingMessage{
			ExternalID:  value.Statuses[0].ID,
			ContentType: "status",
			Metadata: map[string]string{
				"status":           value.Statuses[0].Status,
				"phone_number_id":  value.Metadata.PhoneNumberID,
			},
		}, nil
	}

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
		Metadata: map[string]string{
			"phone_number_id":      value.Metadata.PhoneNumberID,
			"display_phone_number": value.Metadata.DisplayPhoneNumber,
		},
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
