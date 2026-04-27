package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/repliq/backend/internal/services/channel"
)

// Provider implements the channel.Provider interface for Telegram Bot API.
type Provider struct {
	botToken             string
	businessConnectionID string
}

// NewTelegramProvider creates a new Telegram provider from the given config map.
// Expected keys: "bot_token", "business_connection_id" (optional).
func NewTelegramProvider(config map[string]string) *Provider {
	return &Provider{
		botToken:             config["bot_token"],
		businessConnectionID: config["business_connection_id"],
	}
}

// BusinessConnectionID returns the stored business connection id (may be empty).
func (p *Provider) BusinessConnectionID() string {
	return p.businessConnectionID
}

func (p *Provider) GetType() string {
	return "telegram"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	chatID, err := strconv.ParseInt(contactExternalID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("telegram: invalid chat_id: %w", err)
	}

	// No attachments: plain sendMessage
	if len(attachments) == 0 {
		return p.sendText(ctx, chatID, content)
	}

	// With attachments: use sendPhoto / sendVideo / sendDocument per attachment.
	// Caption goes on the FIRST attachment; rest are sent without caption.
	var lastID string
	for i, att := range attachments {
		caption := ""
		if i == 0 {
			caption = content
		}
		id, err := p.sendMedia(ctx, chatID, att, caption)
		if err != nil {
			return lastID, err
		}
		lastID = id
	}
	return lastID, nil
}

// sendText sends a plain text message via sendMessage.
func (p *Provider) sendText(ctx context.Context, chatID int64, content string) (string, error) {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    content,
	}
	if p.businessConnectionID != "" {
		payload["business_connection_id"] = p.businessConnectionID
	}
	return p.callAPI(ctx, "sendMessage", payload)
}

// sendMedia picks the right Telegram method (sendPhoto/sendVideo/sendAudio/sendDocument)
// based on attachment FileType. Uses multipart upload when Data is set, otherwise
// passes FileURL by reference.
func (p *Provider) sendMedia(ctx context.Context, chatID int64, att channel.IncomingAttachment, caption string) (string, error) {
	if len(att.Data) == 0 && att.FileURL == "" {
		return "", fmt.Errorf("telegram: attachment has neither Data nor FileURL")
	}

	method := "sendDocument"
	field := "document"
	ft := att.FileType
	switch {
	case ft == "image" || strings.HasPrefix(ft, "image/"):
		method = "sendPhoto"
		field = "photo"
	case strings.HasPrefix(ft, "video/"):
		method = "sendVideo"
		field = "video"
	case strings.HasPrefix(ft, "audio/"):
		method = "sendAudio"
		field = "audio"
	}

	if len(att.Data) > 0 {
		return p.uploadMultipart(ctx, method, field, chatID, caption, att)
	}

	payload := map[string]interface{}{
		"chat_id": chatID,
		field:     att.FileURL,
	}
	if caption != "" {
		payload["caption"] = caption
	}
	if p.businessConnectionID != "" {
		payload["business_connection_id"] = p.businessConnectionID
	}
	return p.callAPI(ctx, method, payload)
}

// uploadMultipart sends a file as multipart/form-data so Telegram hosts it.
func (p *Provider) uploadMultipart(ctx context.Context, method, field string, chatID int64, caption string, att channel.IncomingAttachment) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	if caption != "" {
		_ = w.WriteField("caption", caption)
	}
	if p.businessConnectionID != "" {
		_ = w.WriteField("business_connection_id", p.businessConnectionID)
	}
	fileName := att.FileName
	if fileName == "" {
		fileName = field // fallback
	}
	fw, err := w.CreateFormFile(field, fileName)
	if err != nil {
		return "", err
	}
	if _, err := fw.Write(att.Data); err != nil {
		return "", err
	}
	w.Close()

	url := fmt.Sprintf("https://api.telegram.org/bot%s/%s", p.botToken, method)
	req, err := http.NewRequestWithContext(ctx, "POST", url, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("telegram: %s upload failed: %w", method, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("telegram: %s upload error %d: %s", method, resp.StatusCode, string(respBody))
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

// callAPI POSTs JSON to the Telegram Bot API and returns the message_id.
func (p *Provider) callAPI(ctx context.Context, method string, payload map[string]interface{}) (string, error) {
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/%s", p.botToken, method)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("telegram: %s failed: %w", method, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		bodyStr := string(respBody)
		if strings.Contains(bodyStr, "BUSINESS_PEER_USAGE_MISSING") {
			return "", fmt.Errorf("Telegram: Müşteri son 24 saat içinde mesaj atmadığı için Business üzerinden gönderim engellendi. Lütfen patron hesabından önce manuel bir mesaj atın, sonra panelden devam edin.")
		}
		if strings.Contains(bodyStr, "bot was blocked") {
			return "", fmt.Errorf("Telegram: Bu kullanıcı bot'u engellemiş, mesaj iletilemiyor.")
		}
		if strings.Contains(bodyStr, "chat not found") {
			return "", fmt.Errorf("Telegram: Sohbet bulunamadı (chat_id geçersiz).")
		}
		return "", fmt.Errorf("telegram: %s API error %d: %s", method, resp.StatusCode, bodyStr)
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

// telegramMessage represents a Telegram message (regular or business).
type telegramMessage struct {
	MessageID            int    `json:"message_id"`
	BusinessConnectionID string `json:"business_connection_id,omitempty"`
	From                 struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Username  string `json:"username"`
	} `json:"from"`
	Chat struct {
		ID        int64  `json:"id"`
		Type      string `json:"type"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Username  string `json:"username"`
	} `json:"chat"`
	Text  string `json:"text"`
	Photo []struct {
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
	Video *struct {
		FileID   string `json:"file_id"`
		FileName string `json:"file_name"`
		MimeType string `json:"mime_type"`
		FileSize int64  `json:"file_size"`
		Duration int    `json:"duration"`
	} `json:"video,omitempty"`
	Audio *struct {
		FileID   string `json:"file_id"`
		FileName string `json:"file_name"`
		MimeType string `json:"mime_type"`
		FileSize int64  `json:"file_size"`
		Duration int    `json:"duration"`
		Title    string `json:"title"`
	} `json:"audio,omitempty"`
	Animation *struct {
		FileID   string `json:"file_id"`
		FileName string `json:"file_name"`
		MimeType string `json:"mime_type"`
		FileSize int64  `json:"file_size"`
	} `json:"animation,omitempty"`
	VideoNote *struct {
		FileID   string `json:"file_id"`
		FileSize int64  `json:"file_size"`
		Duration int    `json:"duration"`
	} `json:"video_note,omitempty"`
	Caption string `json:"caption,omitempty"`
}

// businessConnection represents a Telegram Business Connection event payload.
type businessConnection struct {
	ID         string `json:"id"`
	UserChatID int64  `json:"user_chat_id"`
	Date       int64  `json:"date"`
	IsEnabled  bool   `json:"is_enabled"`
	User       struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
	} `json:"user"`
}

// webhookPayload represents a Telegram Bot API Update structure.
type webhookPayload struct {
	UpdateID           int                 `json:"update_id"`
	Message            *telegramMessage    `json:"message,omitempty"`
	BusinessMessage    *telegramMessage    `json:"business_message,omitempty"`
	BusinessConnection *businessConnection `json:"business_connection,omitempty"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("telegram: failed to parse webhook body: %w", err)
	}

	// Business connection event - bot was connected to (or disconnected from) a business account
	if payload.BusinessConnection != nil {
		bc := payload.BusinessConnection
		connID := ""
		if bc.IsEnabled {
			connID = bc.ID
		}
		return &channel.IncomingMessage{
			ExternalID:  bc.ID,
			ContentType: "business_connection",
			Content:     connID,
			Metadata: map[string]string{
				"business_connection_id": connID,
				"is_enabled":             strconv.FormatBool(bc.IsEnabled),
			},
		}, nil
	}

	// Pick whichever message is present (regular or business)
	tm := payload.Message
	if tm == nil {
		tm = payload.BusinessMessage
	}
	if tm == nil {
		return nil, fmt.Errorf("telegram: no message in webhook payload")
	}

	from := tm.From

	// Use caption as content when message is media without text
	content := tm.Text
	if content == "" {
		content = tm.Caption
	}

	// Business mode: chat.id is ALWAYS the customer (private chat partner).
	// If from.id != chat.id → patron is sending to customer (outbound/echo).
	// If from.id == chat.id → customer is writing to patron (inbound).
	isBusinessOutbound := tm.BusinessConnectionID != "" && from.ID != tm.Chat.ID

	var customerID int64
	var customerName string
	var customerAvatar string
	if tm.BusinessConnectionID != "" {
		customerID = tm.Chat.ID
		customerName = strings.TrimSpace(tm.Chat.FirstName + " " + tm.Chat.LastName)
		if customerName == "" {
			customerName = tm.Chat.Username
		}
		customerAvatar = p.getUserAvatarURL(ctx, customerID)
	} else {
		customerID = from.ID
		customerName = strings.TrimSpace(from.FirstName + " " + from.LastName)
		if customerName == "" {
			customerName = from.Username
		}
		customerAvatar = p.getUserAvatarURL(ctx, from.ID)
	}

	msg := &channel.IncomingMessage{
		ExternalID:  strconv.Itoa(tm.MessageID),
		SenderID:    strconv.FormatInt(customerID, 10),
		SenderName:  customerName,
		AvatarURL:   customerAvatar,
		Content:     content,
		ContentType: "text",
	}

	if isBusinessOutbound {
		msg.IsEcho = true
		msg.RecipientID = strconv.FormatInt(tm.Chat.ID, 10)
		msg.SenderID = strconv.FormatInt(from.ID, 10)
	}

	if tm.BusinessConnectionID != "" {
		msg.Metadata = map[string]string{
			"business_connection_id": tm.BusinessConnectionID,
		}
	}

	// Handle photo attachments
	if len(tm.Photo) > 0 {
		// Use the largest photo (last in array)
		photo := tm.Photo[len(tm.Photo)-1]
		fileURL := p.getFileURL(ctx, photo.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  fileURL,
			FileType: "image",
			FileSize: photo.FileSize,
		})
		msg.ContentType = "image"
	}

	// Handle document
	if tm.Document != nil {
		doc := tm.Document
		fileURL := p.getFileURL(ctx, doc.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: doc.FileName,
			FileURL:  fileURL,
			FileType: doc.MimeType,
			FileSize: doc.FileSize,
		})
		msg.ContentType = "document"
	}

	// Handle voice (push-to-talk OGG)
	if tm.Voice != nil {
		voice := tm.Voice
		fileURL := p.getFileURL(ctx, voice.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  fileURL,
			FileType: "audio/ogg",
			FileSize: voice.FileSize,
		})
		msg.ContentType = "audio"
	}

	// Handle video
	if tm.Video != nil {
		v := tm.Video
		fileURL := p.getFileURL(ctx, v.FileID)
		mime := v.MimeType
		if mime == "" {
			mime = "video/mp4"
		}
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: v.FileName,
			FileURL:  fileURL,
			FileType: mime,
			FileSize: v.FileSize,
		})
		msg.ContentType = "video"
	}

	// Handle audio (mp3 vb. uploaded music files)
	if tm.Audio != nil {
		a := tm.Audio
		fileURL := p.getFileURL(ctx, a.FileID)
		mime := a.MimeType
		if mime == "" {
			mime = "audio/mpeg"
		}
		fileName := a.FileName
		if fileName == "" {
			fileName = a.Title
		}
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: fileName,
			FileURL:  fileURL,
			FileType: mime,
			FileSize: a.FileSize,
		})
		msg.ContentType = "audio"
	}

	// Handle animation / GIF
	if tm.Animation != nil {
		ani := tm.Animation
		fileURL := p.getFileURL(ctx, ani.FileID)
		mime := ani.MimeType
		if mime == "" {
			mime = "video/mp4"
		}
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileName: ani.FileName,
			FileURL:  fileURL,
			FileType: mime,
			FileSize: ani.FileSize,
		})
		msg.ContentType = "video"
	}

	// Handle round video note
	if tm.VideoNote != nil {
		vn := tm.VideoNote
		fileURL := p.getFileURL(ctx, vn.FileID)
		msg.Attachments = append(msg.Attachments, channel.IncomingAttachment{
			FileURL:  fileURL,
			FileType: "video/mp4",
			FileSize: vn.FileSize,
		})
		msg.ContentType = "video"
	}

	// Handle sticker
	if tm.Sticker != nil {
		msg.Content = tm.Sticker.Emoji
		if msg.Content == "" {
			msg.Content = "[Sticker]"
		}
	}

	return msg, nil
}

// getUserAvatarURL fetches the user's profile photo and returns a downloadable URL.
// Returns empty string if the user has no profile photo or the call fails.
func (p *Provider) getUserAvatarURL(ctx context.Context, userID int64) string {
	if userID == 0 || p.botToken == "" {
		return ""
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getUserProfilePhotos?user_id=%d&limit=1", p.botToken, userID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return ""
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			TotalCount int `json:"total_count"`
			Photos     [][]struct {
				FileID string `json:"file_id"`
			} `json:"photos"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil || !result.OK || result.Result.TotalCount == 0 || len(result.Result.Photos) == 0 {
		return ""
	}
	sizes := result.Result.Photos[0]
	if len(sizes) == 0 {
		return ""
	}
	// Use the largest size (last in array)
	return p.getFileURL(ctx, sizes[len(sizes)-1].FileID)
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
