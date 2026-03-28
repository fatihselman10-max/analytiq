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
	url := fmt.Sprintf("%s/%s?fields=username,name,profile_pic&access_token=%s", graphAPIBase, userID, p.accessToken)

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
		Username   string `json:"username"`
		ProfilePic string `json:"profile_pic"`
	}
	if err := json.Unmarshal(respBody, &profile); err != nil {
		return "", "", fmt.Errorf("instagram: failed to parse profile: %w", err)
	}

	displayName := profile.Username
	if displayName == "" {
		displayName = profile.Name
	}

	return displayName, profile.ProfilePic, nil
}

// webhookPayload represents Instagram Messaging webhook with attachments support.
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
				MID         string `json:"mid"`
				Text        string `json:"text"`
				Attachments []struct {
					Type    string `json:"type"`
					Payload struct {
						URL string `json:"url"`
					} `json:"payload"`
				} `json:"attachments"`
				ReplyTo *struct {
					MID   string `json:"mid"`
					Story *struct {
						URL string `json:"url"`
						ID  string `json:"id"`
					} `json:"story"`
				} `json:"reply_to"`
				IsDeleted bool `json:"is_deleted"`
			} `json:"message"`
			Referral *struct {
				Ref    string `json:"ref"`
				Source string `json:"source"`
				Type   string `json:"type"`
			} `json:"referral"`
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

	// Check if this is an echo (sent by our own page)
	isEcho := messaging.Sender.ID == p.pageID

	// Skip deleted messages
	if messaging.Message.IsDeleted {
		return nil, fmt.Errorf("instagram: message was deleted")
	}

	senderName := ""
	avatarURL := ""
	if !isEcho {
		name, avatar, err := p.FetchUserProfile(ctx, messaging.Sender.ID)
		if err == nil {
			senderName = name
			avatarURL = avatar
		}
	}

	content := messaging.Message.Text
	contentType := "text"
	var attachments []channel.IncomingAttachment

	// Process attachments (images, videos, audio, stickers, files)
	for _, att := range messaging.Message.Attachments {
		attType := att.Type
		attURL := att.Payload.URL

		if attURL != "" {
			attachments = append(attachments, channel.IncomingAttachment{
				FileURL:  attURL,
				FileType: attType,
			})
		}

		// Set content type and fallback text based on attachment type
		switch attType {
		case "image":
			contentType = "image"
			if content == "" {
				content = "[Gorsel]"
			}
		case "video":
			contentType = "file"
			if content == "" {
				content = "[Video]"
			}
		case "audio":
			contentType = "file"
			if content == "" {
				content = "[Sesli Mesaj]"
			}
		case "file":
			contentType = "file"
			if content == "" {
				content = "[Dosya]"
			}
		case "sticker":
			if content == "" {
				content = "[Cikartma]"
			}
		case "story_mention":
			if content == "" {
				content = "[Hikayede bahsetti]"
			}
		case "share":
			if content == "" {
				content = "[Gonderi paylasimi]"
			}
		case "reel":
			if content == "" {
				content = "[Reels paylasimi]"
			}
		default:
			if content == "" {
				content = "[Ek: " + attType + "]"
			}
		}
	}

	// Handle story replies
	if messaging.Message.ReplyTo != nil && messaging.Message.ReplyTo.Story != nil {
		storyURL := messaging.Message.ReplyTo.Story.URL
		if storyURL != "" {
			attachments = append(attachments, channel.IncomingAttachment{
				FileURL:  storyURL,
				FileType: "story_reply",
			})
		}
		if content == "" {
			content = "[Hikayenize yanit verdi]"
		} else {
			content = "[Hikaye yaniti] " + content
		}
	}

	// Handle referral (e.g., from ads or story)
	if messaging.Referral != nil && content == "" {
		content = "[Reklam/hikaye uzerinden mesaj gonderdi]"
	}

	// Final fallback
	if content == "" {
		content = "[Desteklenmeyen mesaj turu]"
	}

	return &channel.IncomingMessage{
		ExternalID:  messaging.Message.MID,
		SenderID:    messaging.Sender.ID,
		RecipientID: messaging.Recipient.ID,
		SenderName:  senderName,
		AvatarURL:   avatarURL,
		Content:     content,
		ContentType: contentType,
		IsEcho:      isEcho,
		Attachments: attachments,
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
