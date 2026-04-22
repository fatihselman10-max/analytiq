package email

import (
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-message/mail"
	"github.com/repliq/backend/internal/database"
	channelpkg "github.com/repliq/backend/internal/services/channel"
)

type IMAPPoller struct {
	db             *database.DB
	channelService *channelpkg.Service
	imapHost       string
	imapPort       string
	imapUser       string
	imapPassword   string
	channelID      int64
	stopCh         chan struct{}
}

func NewIMAPPoller(db *database.DB, channelService *channelpkg.Service, channelID int64, config map[string]string) *IMAPPoller {
	return &IMAPPoller{
		db:             db,
		channelService: channelService,
		channelID:      channelID,
		imapHost:       config["imap_host"],
		imapPort:       config["imap_port"],
		imapUser:       config["smtp_user"],
		imapPassword:   config["smtp_password"],
		stopCh:         make(chan struct{}),
	}
}

func (p *IMAPPoller) Start() {
	log.Printf("[EMAIL] IMAP poller started for %s (channel %d)", p.imapUser, p.channelID)

	// First run immediately
	p.poll()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.poll()
		case <-p.stopCh:
			log.Printf("[EMAIL] IMAP poller stopped for %s", p.imapUser)
			return
		}
	}
}

func (p *IMAPPoller) Stop() {
	close(p.stopCh)
}

func (p *IMAPPoller) poll() {
	addr := fmt.Sprintf("%s:%s", p.imapHost, p.imapPort)
	c, err := client.DialTLS(addr, nil)
	if err != nil {
		log.Printf("[EMAIL] IMAP connect error: %v", err)
		return
	}
	defer c.Logout()

	if err := c.Login(p.imapUser, p.imapPassword); err != nil {
		log.Printf("[EMAIL] IMAP login error: %v", err)
		return
	}

	mbox, err := c.Select("INBOX", false)
	if err != nil {
		log.Printf("[EMAIL] IMAP select INBOX error: %v", err)
		return
	}

	if mbox.Messages == 0 {
		return
	}

	// Search for unseen messages
	criteria := imap.NewSearchCriteria()
	criteria.WithoutFlags = []string{imap.SeenFlag}
	uids, err := c.Search(criteria)
	if err != nil {
		log.Printf("[EMAIL] IMAP search error: %v", err)
		return
	}

	if len(uids) == 0 {
		return
	}

	log.Printf("[EMAIL] Found %d new emails", len(uids))

	seqset := new(imap.SeqSet)
	seqset.AddNum(uids...)

	// Fetch messages
	section := &imap.BodySectionName{}
	items := []imap.FetchItem{section.FetchItem(), imap.FetchEnvelope}

	messages := make(chan *imap.Message, len(uids))
	done := make(chan error, 1)
	go func() {
		done <- c.Fetch(seqset, items, messages)
	}()

	for msg := range messages {
		p.processMessage(msg, section)
	}

	if err := <-done; err != nil {
		log.Printf("[EMAIL] IMAP fetch error: %v", err)
	}
}

func (p *IMAPPoller) processMessage(imapMsg *imap.Message, section *imap.BodySectionName) {
	if imapMsg == nil || imapMsg.Envelope == nil {
		return
	}

	envelope := imapMsg.Envelope

	// Skip emails sent by ourselves
	for _, from := range envelope.From {
		if strings.EqualFold(from.Address(), p.imapUser) {
			return
		}
	}

	// Get sender info
	var senderEmail, senderName string
	if len(envelope.From) > 0 {
		senderEmail = envelope.From[0].Address()
		senderName = envelope.From[0].PersonalName
		if senderName == "" {
			senderName = extractNameFromEmail(senderEmail)
		}
	}

	if senderEmail == "" {
		return
	}

	// Check if we already processed this message
	messageID := envelope.MessageId
	if messageID == "" {
		messageID = fmt.Sprintf("imap_%s_%d", senderEmail, imapMsg.SeqNum)
	}

	ctx := context.Background()
	var existingID int64
	err := p.db.Pool.QueryRow(ctx,
		`SELECT id FROM messages WHERE external_id = $1 LIMIT 1`, messageID,
	).Scan(&existingID)
	if err == nil {
		// Already processed
		return
	}

	// Parse body
	body := imapMsg.GetBody(section)
	if body == nil {
		return
	}

	content := ""
	var plainAttachments []channelpkg.IncomingAttachment
	mr, err := mail.CreateReader(body)
	if err != nil {
		// Fallback: use subject
		content = envelope.Subject
	} else {
		for {
			part, err := mr.NextPart()
			if err != nil {
				break
			}
			switch h := part.Header.(type) {
			case *mail.InlineHeader:
				ct := h.Get("Content-Type")
				if strings.HasPrefix(ct, "text/plain") || ct == "" {
					b, err := io.ReadAll(part.Body)
					if err == nil && len(b) > 0 {
						content = string(b)
					}
				}
			case *mail.AttachmentHeader:
				filename, _ := h.Filename()
				if filename == "" {
					continue
				}
				data, err := io.ReadAll(part.Body)
				if err != nil || len(data) == 0 {
					continue
				}
				plainAttachments = append(plainAttachments, channelpkg.IncomingAttachment{
					FileName: filename,
					FileType: h.Get("Content-Type"),
					FileSize: int64(len(data)),
					Data:     data,
				})
			}
		}
	}

	if content == "" {
		content = envelope.Subject
	}
	if content == "" {
		content = "(Boş mesaj)"
	}

	// Clean up quoted replies - remove lines starting with > and signature blocks
	content = cleanEmailContent(content)

	incomingMsg := &channelpkg.IncomingMessage{
		ExternalID:  messageID,
		SenderID:    senderEmail,
		SenderName:  senderName,
		Subject:     envelope.Subject,
		Content:     content,
		ContentType: "text",
		Attachments: plainAttachments,
	}

	result, err := p.channelService.HandleIncomingMessage(ctx, p.channelID, incomingMsg)
	if err != nil {
		log.Printf("[EMAIL] Failed to handle message from %s: %v", senderEmail, err)
		return
	}

	log.Printf("[EMAIL] Processed email from %s -> conversation %d, message %d (new: %v)",
		senderEmail, result.ConversationID, result.MessageID, result.IsNew)
}

func cleanEmailContent(content string) string {
	lines := strings.Split(content, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Stop at signature or quoted reply markers
		if trimmed == "--" || trimmed == "---" || strings.HasPrefix(trimmed, ">") {
			break
		}
		// Stop at common reply headers
		lower := strings.ToLower(trimmed)
		if strings.Contains(lower, "wrote:") || strings.Contains(lower, "yazdı:") {
			break
		}
		cleaned = append(cleaned, line)
	}
	result := strings.TrimSpace(strings.Join(cleaned, "\n"))
	if result == "" {
		return content // fallback to original if cleaning removed everything
	}
	return result
}
