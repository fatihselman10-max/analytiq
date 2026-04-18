package vk

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for VK Messages API.
type Provider struct {
	accessToken      string
	groupID          string
	secretKey        string
	confirmationCode string
}

// NewVKProvider creates a new VK provider from the given config map.
// Expected keys: "access_token", "group_id", "secret_key", "confirmation_code".
func NewVKProvider(config map[string]string) *Provider {
	return &Provider{
		accessToken:      config["access_token"],
		groupID:          config["group_id"],
		secretKey:        config["secret_key"],
		confirmationCode: config["confirmation_code"],
	}
}

func (p *Provider) GetType() string {
	return "vk"
}

func (p *Provider) GetConfirmationCode() string {
	return p.confirmationCode
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	params := url.Values{}
	params.Set("peer_id", contactExternalID)
	params.Set("message", content)
	params.Set("random_id", strconv.Itoa(rand.Int()))
	params.Set("access_token", p.accessToken)
	params.Set("v", "5.199")

	apiURL := "https://api.vk.com/method/messages.send?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("vk: send failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Response int `json:"response"`
		Error    *struct {
			ErrorCode int    `json:"error_code"`
			ErrorMsg  string `json:"error_msg"`
		} `json:"error"`
	}
	json.Unmarshal(body, &result)

	if result.Error != nil {
		return "", fmt.Errorf("vk: API error %d: %s", result.Error.ErrorCode, result.Error.ErrorMsg)
	}

	return strconv.Itoa(result.Response), nil
}

// webhookPayload represents a VK Callback API event structure.
type webhookPayload struct {
	Type    string `json:"type"`
	GroupID int    `json:"group_id"`
	Secret  string `json:"secret"`
	Object  struct {
		Message struct {
			ID          int    `json:"id"`
			FromID      int    `json:"from_id"`
			PeerID      int    `json:"peer_id"`
			Text        string `json:"text"`
			Attachments []struct {
				Type string `json:"type"`
				Doc  *struct {
					Title string `json:"title"`
					URL   string `json:"url"`
					Size  int64  `json:"size"`
					Ext   string `json:"ext"`
				} `json:"doc,omitempty"`
				Photo *struct {
					Sizes []struct {
						URL string `json:"url"`
					} `json:"sizes"`
				} `json:"photo,omitempty"`
			} `json:"attachments"`
		} `json:"message"`
	} `json:"object"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("vk: failed to parse webhook body: %w", err)
	}

	// VK confirmation request - return special message
	if payload.Type == "confirmation" {
		return &channel.IncomingMessage{
			ExternalID:  "confirmation",
			ContentType: "confirmation",
			Content:     p.confirmationCode,
		}, nil
	}

	if payload.Type != "message_new" {
		return nil, fmt.Errorf("vk: unsupported event type: %s", payload.Type)
	}

	// Validate secret if configured
	if p.secretKey != "" && payload.Secret != p.secretKey {
		return nil, fmt.Errorf("vk: invalid secret key")
	}

	vkMsg := payload.Object.Message

	senderName, avatarURL := p.fetchUser(ctx, vkMsg.FromID)

	msg := &channel.IncomingMessage{
		ExternalID:  strconv.Itoa(vkMsg.ID),
		SenderID:    strconv.Itoa(vkMsg.FromID),
		SenderName:  senderName,
		AvatarURL:   avatarURL,
		Content:     vkMsg.Text,
		ContentType: "text",
	}

	for _, att := range vkMsg.Attachments {
		switch att.Type {
		case "doc":
			if att.Doc != nil {
				msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
					FileName: att.Doc.Title,
					FileURL:  att.Doc.URL,
					FileType: att.Doc.Ext,
					FileSize: att.Doc.Size,
				})
			}
		case "photo":
			if att.Photo != nil && len(att.Photo.Sizes) > 0 {
				lastSize := att.Photo.Sizes[len(att.Photo.Sizes)-1]
				msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
					FileURL:  lastSize.URL,
					FileType: "image",
				})
			}
		}
	}

	if len(msg.Attachments) > 0 {
		msg.ContentType = "attachment"
	}

	return msg, nil
}

// fetchUser calls users.get to get the sender's name and avatar (photo_200).
// Returns ("", "") if the call fails or user_id is invalid (e.g., negative for groups).
func (p *Provider) fetchUser(ctx context.Context, userID int) (string, string) {
	if userID <= 0 || p.accessToken == "" {
		return "", ""
	}
	params := url.Values{}
	params.Set("user_ids", strconv.Itoa(userID))
	params.Set("fields", "photo_200")
	params.Set("access_token", p.accessToken)
	params.Set("v", "5.199")

	apiURL := "https://api.vk.com/method/users.get?" + params.Encode()
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return "", ""
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Response []struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Photo200  string `json:"photo_200"`
		} `json:"response"`
	}
	if err := json.Unmarshal(body, &result); err != nil || len(result.Response) == 0 {
		return "", ""
	}
	u := result.Response[0]
	name := u.FirstName
	if u.LastName != "" {
		if name != "" {
			name += " "
		}
		name += u.LastName
	}
	return name, u.Photo200
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"access_token", "group_id"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("vk: missing required credential: %s", key)
		}
	}
	return nil
}
