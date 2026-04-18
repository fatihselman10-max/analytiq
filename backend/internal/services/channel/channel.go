package channel

import "context"

type IncomingMessage struct {
	ExternalID  string
	SenderID    string
	RecipientID string // the other party (used for echo messages to find customer)
	SenderName  string
	AvatarURL   string
	Content     string
	ContentType string // text, image, file
	IsEcho      bool   // true if sent by our own page (not a customer message)
	Attachments []IncomingAttachment
	Metadata    map[string]string // provider-specific data (e.g. telegram business_connection_id)
}

type IncomingAttachment struct {
	FileName string
	FileURL  string
	FileType string
	FileSize int64
	Data     []byte // raw file bytes for multipart upload (used by outgoing sends)
}

type Provider interface {
	GetType() string
	SendMessage(ctx context.Context, contactExternalID string, content string, attachments []IncomingAttachment) (externalID string, err error)
	ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*IncomingMessage, error)
	ValidateCredentials(ctx context.Context, creds map[string]string) error
}
