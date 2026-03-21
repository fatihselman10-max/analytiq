package instagram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/repliq/backend/internal/services/channel"
)

type Provider struct {
	pageID      string
	accessToken string
	appSecret   string
}

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
	if p.accessToken == "" {
		return "", fmt.Errorf("instagram: access token not configured")
	}

	// Instagram Graph API - Send Message
	url := fmt.Sprintf("https://graph.instagram.com/v21.0/me/messages?access_token=%s", p.accessToken)

	payload := map[string]interface{}{
		"recipient": map[string]string{
			"id": contactExternalID,
		},
		"message": map[string]string{
			"text": content,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("instagram: failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("instagram: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("instagram: failed to send message: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("instagram: API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		MessageID string `json:"message_id"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("instagram: failed to parse response: %w", err)
	}

	return result.MessageID, nil
}

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
	required := []string{"access_token"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("instagram: missing required credential: %s", key)
		}
	}
	return nil
}
