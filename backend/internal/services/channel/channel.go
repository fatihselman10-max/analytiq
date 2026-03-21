package channel

import "context"

type IncomingMessage struct {
	ExternalID  string
	SenderID    string
	SenderName  string
	AvatarURL   string
	Content     string
	ContentType string // text, image, file
	Attachments []IncomingAttachment
}

type IncomingAttachment struct {
	FileName string
	FileURL  string
	FileType string
	FileSize int64
}

type Provider interface {
	GetType() string
	SendMessage(ctx context.Context, contactExternalID string, content string, attachments []IncomingAttachment) (externalID string, err error)
	ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*IncomingMessage, error)
	ValidateCredentials(ctx context.Context, creds map[string]string) error
}
