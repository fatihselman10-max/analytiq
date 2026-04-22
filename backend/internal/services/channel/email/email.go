package email

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/repliq/backend/internal/services/channel"
)

type Provider struct {
	smtpHost     string
	smtpPort     string
	smtpUser     string
	smtpPassword string
	imapHost     string
	imapPort     string
	fromAddress  string
}

func NewEmailProvider(config map[string]string) *Provider {
	from := config["from_address"]
	if from == "" {
		from = config["smtp_user"]
	}
	return &Provider{
		smtpHost:     config["smtp_host"],
		smtpPort:     config["smtp_port"],
		smtpUser:     config["smtp_user"],
		smtpPassword: config["smtp_password"],
		imapHost:     config["imap_host"],
		imapPort:     config["imap_port"],
		fromAddress:  from,
	}
}

func (p *Provider) GetType() string {
	return "email"
}

func (p *Provider) SendMessage(ctx context.Context, contactExternalID string, content string, attachments []channel.IncomingAttachment) (string, error) {
	return p.SendEmail(ctx, contactExternalID, content, channel.EmailSendOptions{}, attachments)
}

// SendEmail sends an RFC 5322 / MIME email. When opts.InReplyTo is set, proper
// threading headers are attached so Gmail/Outlook keep the conversation together.
// Attachments with non-empty Data are embedded as multipart/mixed parts.
// Implements channel.EmailSender.
func (p *Provider) SendEmail(ctx context.Context, to string, body string, opts channel.EmailSendOptions, attachments []channel.IncomingAttachment) (string, error) {
	subject := strings.TrimSpace(opts.Subject)
	if subject == "" {
		subject = "Mesaj"
	}

	messageID := fmt.Sprintf("<%d.%s@messe-panel>", time.Now().UnixNano(), randomToken(8))

	var headers []string
	headers = append(headers,
		fmt.Sprintf("From: %s", p.fromAddress),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", mime.QEncoding.Encode("utf-8", subject)),
		fmt.Sprintf("Date: %s", time.Now().Format(time.RFC1123Z)),
		fmt.Sprintf("Message-ID: %s", messageID),
		"MIME-Version: 1.0",
	)
	if opts.InReplyTo != "" {
		headers = append(headers, fmt.Sprintf("In-Reply-To: %s", ensureAngle(opts.InReplyTo)))
	}
	if len(opts.References) > 0 {
		refs := make([]string, 0, len(opts.References))
		for _, r := range opts.References {
			if r != "" {
				refs = append(refs, ensureAngle(r))
			}
		}
		if len(refs) > 0 {
			headers = append(headers, fmt.Sprintf("References: %s", strings.Join(refs, " ")))
		}
	}

	// Filter attachments that actually have bytes; URL-only ones can't be embedded yet.
	var usable []channel.IncomingAttachment
	for _, a := range attachments {
		if len(a.Data) > 0 {
			usable = append(usable, a)
		}
	}

	var msgBuf bytes.Buffer
	if len(usable) == 0 {
		headers = append(headers, "Content-Type: text/plain; charset=\"utf-8\"")
		msgBuf.WriteString(strings.Join(headers, "\r\n"))
		msgBuf.WriteString("\r\n\r\n")
		msgBuf.WriteString(body)
	} else {
		boundary := "mixed_" + randomToken(16)
		headers = append(headers, fmt.Sprintf("Content-Type: multipart/mixed; boundary=%q", boundary))
		msgBuf.WriteString(strings.Join(headers, "\r\n"))
		msgBuf.WriteString("\r\n\r\n")

		// text part
		msgBuf.WriteString("--" + boundary + "\r\n")
		msgBuf.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n")
		msgBuf.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
		msgBuf.WriteString(body)
		msgBuf.WriteString("\r\n")

		for _, att := range usable {
			fname := att.FileName
			if fname == "" {
				fname = "file"
			}
			ctype := att.FileType
			if ctype == "" {
				ctype = "application/octet-stream"
			}
			msgBuf.WriteString("--" + boundary + "\r\n")
			msgBuf.WriteString(fmt.Sprintf("Content-Type: %s; name=%q\r\n", ctype, fname))
			msgBuf.WriteString("Content-Transfer-Encoding: base64\r\n")
			msgBuf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=%q\r\n\r\n", fname))
			enc := base64.StdEncoding.EncodeToString(att.Data)
			// wrap at 76 chars as per RFC
			for i := 0; i < len(enc); i += 76 {
				end := i + 76
				if end > len(enc) {
					end = len(enc)
				}
				msgBuf.WriteString(enc[i:end])
				msgBuf.WriteString("\r\n")
			}
		}
		msgBuf.WriteString("--" + boundary + "--\r\n")
	}

	addr := net.JoinHostPort(p.smtpHost, p.smtpPort)
	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return "", fmt.Errorf("email: failed to connect to SMTP: %w", err)
	}
	client, err := smtp.NewClient(conn, p.smtpHost)
	if err != nil {
		return "", fmt.Errorf("email: failed to create SMTP client: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{ServerName: p.smtpHost}
	if err = client.StartTLS(tlsConfig); err != nil {
		return "", fmt.Errorf("email: STARTTLS failed: %w", err)
	}

	auth := smtp.PlainAuth("", p.smtpUser, p.smtpPassword, p.smtpHost)
	if err = client.Auth(auth); err != nil {
		return "", fmt.Errorf("email: auth failed: %w", err)
	}
	if err = client.Mail(p.fromAddress); err != nil {
		return "", fmt.Errorf("email: MAIL FROM failed: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return "", fmt.Errorf("email: RCPT TO failed: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return "", fmt.Errorf("email: DATA failed: %w", err)
	}
	if _, err = w.Write(msgBuf.Bytes()); err != nil {
		return "", fmt.Errorf("email: write body failed: %w", err)
	}
	if err = w.Close(); err != nil {
		return "", fmt.Errorf("email: close body failed: %w", err)
	}
	client.Quit()

	return messageID, nil
}

type webhookPayload struct {
	MessageID string `json:"message_id"`
	From      string `json:"from"`
	FromName  string `json:"from_name"`
	To        string `json:"to"`
	Subject   string `json:"subject"`
	TextBody  string `json:"text_body"`
	HTMLBody  string `json:"html_body"`
}

func (p *Provider) ParseWebhook(ctx context.Context, body []byte, headers map[string]string) (*channel.IncomingMessage, error) {
	var payload webhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("email: failed to parse webhook: %w", err)
	}

	content := payload.TextBody
	if content == "" {
		content = payload.HTMLBody
	}
	if content == "" {
		content = payload.Subject
	}

	senderName := payload.FromName
	if senderName == "" {
		senderName = extractNameFromEmail(payload.From)
	}

	return &channel.IncomingMessage{
		ExternalID:  payload.MessageID,
		SenderID:    payload.From,
		SenderName:  senderName,
		Subject:     payload.Subject,
		Content:     content,
		ContentType: "text",
	}, nil
}

func (p *Provider) ValidateCredentials(ctx context.Context, creds map[string]string) error {
	required := []string{"smtp_host", "smtp_port", "smtp_user", "smtp_password"}
	for _, key := range required {
		if creds[key] == "" {
			return fmt.Errorf("email: missing required credential: %s", key)
		}
	}
	return nil
}

func extractNameFromEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) > 0 {
		return parts[0]
	}
	return email
}

func ensureAngle(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return id
	}
	if strings.HasPrefix(id, "<") && strings.HasSuffix(id, ">") {
		return id
	}
	return "<" + strings.Trim(id, "<>") + ">"
}

func randomToken(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	t := time.Now().UnixNano()
	for i := range b {
		b[i] = chars[t%int64(len(chars))]
		t /= int64(len(chars))
		if t == 0 {
			t = time.Now().UnixNano() + int64(i)
		}
	}
	return string(b)
}
