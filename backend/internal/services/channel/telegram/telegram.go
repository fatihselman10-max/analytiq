package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Telegram Bot API.
type Provider struct {
	botToken string
}

// NewTelegramProvider creates a new Telegram provider from the given config map.
// Expected keys: "bot_token".
func NewTelegramProvider(config map[string]string) *Provider {
	return &Provider{
		botToken: config["bot_token"],
	}
}

func (p *Provider) GetType() string {
	return "telegram"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	chatID, err := strconv.ParseInt(contactExternalID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("telegram: invalid chat_id: %w", err)
	}

	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    content,
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", p.botToken)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("telegram: send failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("telegram: API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int `json:"message_id"`
		} `json:"result"`
	}
	json.Unmarshal(respBody, &result)

	return strconv.Itoa(result.Result.MessageID), nil
}

// webhookPayload represents a Telegram Bot API Update structure.
type webhookPayload struct {
	UpdateID int `json:"update_id"`
	Message  *struct {
		MessageID int `json:"message_id"`
		From      struct {
			ID        int64  `json:"id"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Username  string `json:"username"`
		} `json:"from"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
		Text     string `json:"text"`
		Photo    []struct {
			FileID   string `json:"file_id"`
			FileSize int64  `json:"file_size"`
		} `json:"photo,omitempty"`
		Document *struct {
			FileName string `json:"file_name"`
			FileID   string `json:"file_id"`
			FileSize int64  `json:"file_size"`
			MimeType string `json:"mime_type"`
		} `json:"document,omitempty"`
		Sticker *struct {
			FileID string `json:"file_id"`
			Emoji  string `json:"emoji"`
		} `json:"sticker,omitempty"`
		Voice *struct {
			FileID   string `json:"file_id"`
			Duration int    `json:"duration"`
			FileSize int64  `json:"file_size"`
		} `json:"voice,omitempty"`
	} `json:"message,omitempty"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("telegram: failed to parse webhook body: %w", err)
	}

	if payload.Message == nil {
		return nil, fmt.Errorf("telegram: no message in webhook payload")
	}

	from := payload.Message.From
	senderName := from.FirstName
	if from.LastName != "" {
		senderName += " " + from.LastName
	}

	msg := &channel.IncomingMessage{
		ExternalID:  strconv.Itoa(payload.Message.MessageID),
		SenderID:    strconv.FormatInt(from.ID, 10),
		SenderName:  senderName,
		Content:     payload.Message.Text,
		ContentType: "text",
	}

	// Handle photo attachments
	if len(payload.Message.Photo) > 0 {
		// Use the largest photo (last in array)
		photo := payload.Message.Photo[len(payload.Message.Photo)-1]
		fileURL := p.getFileURL(ctx, photo.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  fileURL,
			FileType: "image",
			FileSize: photo.FileSize,
		})
		msg.ContentType = "image"
	}

	// Handle document
	if payload.Message.Document != nil {
		doc := payload.Message.Document
		fileURL := p.getFileURL(ctx, doc.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: doc.FileName,
			FileURL:  fileURL,
			FileType: doc.MimeType,
			FileSize: doc.FileSize,
		})
		msg.ContentType = "document"
	}

	// Handle voice
	if payload.Message.Voice != nil {
		voice := payload.Message.Voice
		fileURL := p.getFileURL(ctx, voice.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  fileURL,
			FileType: "audio/ogg",
			FileSize: voice.FileSize,
		})
		msg.ContentType = "audio"
	}

	// Handle sticker
	if payload.Message.Sticker != nil {
		msg.Content = payload.Message.Sticker.Emoji
		if msg.Content == "" {
			msg.Content = "[Sticker]"
		}
	}

	return msg, nil
}

// getFileURL resolves a Telegram file_id to a download URL
func (p *Provider) getFileURL(ctx context.Context, fileID string) string {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getFile?file_id=%s", p.botToken, fileID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fileID
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fileID
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil || !result.OK {
		return fileID
	}
	return fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", p.botToken, result.Result.FilePath)
}

// HandleBotCommands sends auto-replies for known bot commands.
// Returns true if the message was a command that was handled.
func (p *Provider) HandleBotCommands(ctx context.Context, chatID string, text string) bool {
	commands := map[string]string{
		"/start": "Merhaba! Messe Tekstil'e hosgeldiniz.\n\nPremium kumas uretimi konusunda size yardimci olabiliriz. Numune talebi, fiyat bilgisi veya siparis takibi icin bize yazmaktan cekinmeyin.\n\nEkibimiz en kisa surede size donecektir.",
		"/numune": "Numune talebi icin lutfen asagidaki bilgileri yazin:\n\n1. Firma adi\n2. Ilgilendiginiz kumas turleri\n3. Teslimat adresi ve ulke\n\nEkibimiz talebinizi inceleyip size donecektir.",
		"/fiyat": "Fiyat listesi talebi alindi. Lutfen ilgilendiginiz kumas turlerini belirtin, ekibimiz size ozel fiyat teklifini iletecektir.",
		"/siparis": "Siparis durumu sorgusu icin lutfen siparis numaranizi yazin. Ekibimiz en kisa surede bilgi verecektir.",
		"/iletisim": "Messe Tekstil Iletisim Bilgileri:\n\nWeb: messetekstil.com\nInstagram: @messetekstil\nE-posta: info@messetekstil.com\n\nCalisma Saatleri: Pzt-Cum 09:00-18:00 (GMT+3)",
	}

	reply, ok := commands[text]
	if !ok {
		return false
	}

	p.SendMessage(ctx, chatID, reply, nil)
	return true
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	if creds["bot_token"] == "" {
		return fmt.Errorf("telegram: missing required credential: bot_token")
	}
	return nil
}
