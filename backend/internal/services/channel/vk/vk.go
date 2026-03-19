package vk

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for VK Messages API.
type Provider struct {
	accessToken    string
	groupID        string
	secretKey      string
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

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	externalID := fmt.Sprintf("vk_msg_%s_%s", contactExternalID, "stub-message-id")
	return externalID, nil
}

// webhookPayload represents a simplified VK Callback API event structure.
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

	if payload.Type != "message_new" {
		return nil, fmt.Errorf("vk: unsupported event type: %s", payload.Type)
	}

	vkMsg := payload.Object.Message

	msg := &channel.IncomingMessage{
		ExternalID:  strconv.Itoa(vkMsg.ID),
		SenderID:    strconv.Itoa(vkMsg.FromID),
		SenderName:  "",
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

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"access_token", "group_id"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("vk: missing required credential: %s", key)
		}
	}
	return nil
}
