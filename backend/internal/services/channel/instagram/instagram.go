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

const graphAPIBase = "https://graph.instagram.com/v21.0"

// Provider implements the channel.Provider interface for Instagram Messaging API.
type Provider struct {
	pageID      string
	accessToken string
	appSecret   string
	httpClient  *http.Client
}

// NewInstagramProvider creates a new Instagram provider from the given config map.
func NewInstagramProvider(config map[string]string) *Provider {
	return &Provider{
		pageID:      config["page_id"],
		accessToken: config["access_token"],
		appSecret:   config["app_secret"],
		httpClient:  &http.Client{},
	}
}

func (p *Provider) GetType() string {
	return "instagram"
}

// SendMessage sends a text message to an Instagram user via the Graph API.
func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
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
		return "", fmt.Errorf("instagram: failed to marshal message: %w", err)
	}

	url := fmt.Sprintf("%s/me/messages?access_token=%s", graphAPIBase, p.accessToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("instagram: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("instagram: failed to send message: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("instagram: Graph API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		MessageID string `json:"message_id"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("instagram: failed to parse response: %w", err)
	}

	return result.MessageID, nil
}

// FetchUserProfile fetches the Instagram user's name and profile picture.
func (p *Provider) FetchUserProfile(ctx context.Context, userID string) (name string, avatarURL string, err error) {
	url := fmt.Sprintf("%s/%s?fields=name,profile_pic&access_token=%s", graphAPIBase, userID, p.accessToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", "", fmt.Errorf("instagram: failed to create profile request: %w", err)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("instagram: failed to fetch profile: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("instagram: profile API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var profile struct {
		Name       string `json:"name"`
		ProfilePic string `json:"profile_pic"`
	}
	if err := json.Unmarshal(respBody, &profile); err != nil {
		return "", "", fmt.Errorf("instagram: failed to parse profile: %w", err)
	}

	return profile.Name, profile.ProfilePic, nil
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

	// Skip echo messages (sent by our own page)
	if messaging.Sender.ID == p.pageID {
		return nil, fmt.Errorf("instagram: skipping echo message from own page")
	}

	// Fetch sender profile from Graph API
	senderName := ""
	avatarURL := ""
	name, avatar, err := p.FetchUserProfile(ctx, messaging.Sender.ID)
	if err == nil {
		senderName = name
		avatarURL = avatar
	}

	return &channel.IncomingMessage{
		ExternalID:  messaging.Message.MID,
		SenderID:    messaging.Sender.ID,
		SenderName:  senderName,
		AvatarURL:   avatarURL,
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
