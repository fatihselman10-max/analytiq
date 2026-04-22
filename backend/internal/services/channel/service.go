package channel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/journey"
)

// IncomingHook is called asynchronously after a contact message is persisted.
// orgID, customerID (may be nil), messageID, channelType, content.
type IncomingHook func(orgID int64, customerID *int64, messageID int64, channelType, content string)

type Service struct {
	db           *database.DB
	registry     *Registry
	IncomingHook IncomingHook
	Journey      *journey.Service
}

func NewService(db *database.DB, registry *Registry) *Service {
	return &Service{db: db, registry: registry}
}

// recordJourney writes a timeline entry. Safe to call even if Journey is nil.
// Runs with its own context so caller's cancellation doesn't abort the write.
func (s *Service) recordJourney(orgID, contactID, messageID int64, eventType, source, content string) {
	if s.Journey == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = s.Journey.Insert(ctx, journey.InsertParams{
			OrgID:      orgID,
			ContactID:  contactID,
			EventType:  eventType,
			Source:     source,
			Title:      journey.Truncate(content, 120),
			Body:       content,
			ExternalID: fmt.Sprintf("msg:%d", messageID),
		})
	}()
}

type HandleResult struct {
	ConversationID int64
	MessageID      int64
	ContactID      int64
	OrgID          int64
	IsNew          bool
}

func (s *Service) HandleIncomingMessage(ctx context.Context, channelID int64, msg *IncomingMessage) (*HandleResult, error) {
	// Get channel info
	var orgID int64
	var channelType string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT org_id, type FROM channels WHERE id = $1 AND is_active = true`,
		channelID,
	).Scan(&orgID, &channelType)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}

	// Find or create contact
	var contactID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO contacts (org_id, external_id, channel_type, name, avatar_url)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (org_id, channel_type, external_id) DO UPDATE
		 SET name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE contacts.name END,
		     avatar_url = CASE WHEN EXCLUDED.avatar_url != '' THEN EXCLUDED.avatar_url ELSE contacts.avatar_url END
		 RETURNING id`,
		orgID, msg.SenderID, channelType, msg.SenderName, msg.AvatarURL,
	).Scan(&contactID)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert contact: %w", err)
	}

	// Try to match sender to a CRM customer via customer_channels
	var customerID *int64
	var matchedCustID int64
	err = s.db.Pool.QueryRow(ctx,
		`SELECT cc.customer_id FROM customer_channels cc
		 JOIN customers cu ON cu.id = cc.customer_id AND cu.org_id = $1
		 WHERE LOWER(cc.channel_type) = LOWER($2)
		   AND (cc.channel_identifier = $3 OR cc.channel_identifier = $4)
		 LIMIT 1`,
		orgID, channelType, msg.SenderID, msg.SenderName,
	).Scan(&matchedCustID)
	if err == nil {
		customerID = &matchedCustID
	} else {
		// Also try matching by customer name, phone, email, instagram
		err = s.db.Pool.QueryRow(ctx,
			`SELECT id FROM customers
			 WHERE org_id = $1 AND (
			   name = $2 OR phone = $2 OR email = $2 OR instagram = $2
			 ) LIMIT 1`,
			orgID, msg.SenderName,
		).Scan(&matchedCustID)
		if err == nil {
			customerID = &matchedCustID
		}
	}

	// Find existing open/pending conversation or reopen a resolved one
	var conversationID int64
	isNew := false
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM conversations
		 WHERE org_id = $1 AND contact_id = $2 AND channel_id = $3 AND status IN ('open', 'pending')
		 ORDER BY created_at DESC LIMIT 1`,
		orgID, contactID, channelID,
	).Scan(&conversationID)
	if err != nil {
		// No open/pending conversation — check if there's a recently resolved one to reopen
		err = s.db.Pool.QueryRow(ctx,
			`SELECT id FROM conversations
			 WHERE org_id = $1 AND contact_id = $2 AND channel_id = $3 AND status = 'resolved'
			 ORDER BY last_message_at DESC LIMIT 1`,
			orgID, contactID, channelID,
		).Scan(&conversationID)
		if err == nil {
			// Reopen the resolved conversation
			_, _ = s.db.Pool.Exec(ctx,
				`UPDATE conversations SET status = 'open', resolved_at = NULL, updated_at = NOW(), customer_id = COALESCE(customer_id, $2) WHERE id = $1`,
				conversationID, customerID,
			)
		} else {
			// Create new conversation
			isNew = true
			subject := msg.Subject
			if subject == "" {
				subject = msg.Content
			}
			if len(subject) > 200 {
				subject = subject[:200]
			}
			err = s.db.Pool.QueryRow(ctx,
				`INSERT INTO conversations (org_id, channel_id, contact_id, customer_id, status, priority, subject, last_message_at)
				 VALUES ($1, $2, $3, $4, 'open', 'normal', $5, NOW())
				 RETURNING id`,
				orgID, channelID, contactID, customerID, subject,
			).Scan(&conversationID)
			if err != nil {
				return nil, fmt.Errorf("failed to create conversation: %w", err)
			}
		}
	} else if customerID != nil {
		// Update existing conversation with customer_id if not set
		s.db.Pool.Exec(ctx,
			`UPDATE conversations SET customer_id = COALESCE(customer_id, $2) WHERE id = $1`,
			conversationID, customerID,
		)
	}

	// Insert message
	var messageID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, content, content_type, external_id)
		 VALUES ($1, 'contact', $2, $3, $4)
		 RETURNING id`,
		conversationID, msg.Content, msg.ContentType, msg.ExternalID,
	).Scan(&messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert message: %w", err)
	}

	// Insert attachments
	for _, att := range msg.Attachments {
		_, err = s.db.Pool.Exec(ctx,
			`INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size)
			 VALUES ($1, $2, $3, $4, $5)`,
			messageID, att.FileName, att.FileURL, att.FileType, att.FileSize,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert attachment: %w", err)
		}
	}

	// Update conversation last_message_at
	now := time.Now()
	_, err = s.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $2 WHERE id = $3`,
		now, now, conversationID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update conversation: %w", err)
	}

	if s.IncomingHook != nil && msg.ContentType == "text" {
		go s.IncomingHook(orgID, customerID, messageID, channelType, msg.Content)
	}

	s.recordJourney(orgID, contactID, messageID, "message_in", channelType, msg.Content)

	return &HandleResult{
		ConversationID: conversationID,
		MessageID:      messageID,
		ContactID:      contactID,
		OrgID:          orgID,
		IsNew:          isNew,
	}, nil
}

// HandleEchoMessage saves a message sent by our own page as an agent message
// in the correct customer conversation.
func (s *Service) HandleEchoMessage(ctx context.Context, channelID int64, msg *IncomingMessage) (*HandleResult, error) {
	var orgID int64
	var channelType string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT org_id, type FROM channels WHERE id = $1 AND is_active = true`,
		channelID,
	).Scan(&orgID, &channelType)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}

	// Upsert contact by recipient ID (the person we sent the message TO).
	// For Telegram Business outbound-first conversations, the contact may not exist yet.
	var contactID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO contacts (org_id, external_id, channel_type, name, avatar_url)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (org_id, channel_type, external_id) DO UPDATE
		 SET name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE contacts.name END,
		     avatar_url = CASE WHEN EXCLUDED.avatar_url != '' THEN EXCLUDED.avatar_url ELSE contacts.avatar_url END
		 RETURNING id`,
		orgID, msg.RecipientID, channelType, msg.SenderName, msg.AvatarURL,
	).Scan(&contactID)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert echo contact: %w", err)
	}

	// Find latest open/pending conversation, or create one for first-touch outbound
	var conversationID int64
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM conversations
		 WHERE org_id = $1 AND contact_id = $2 AND channel_id = $3 AND status IN ('open', 'pending')
		 ORDER BY last_message_at DESC LIMIT 1`,
		orgID, contactID, channelID,
	).Scan(&conversationID)
	if err != nil {
		err = s.db.Pool.QueryRow(ctx,
			`INSERT INTO conversations (org_id, contact_id, channel_id, status, priority, subject, last_message_at)
			 VALUES ($1, $2, $3, 'open', 'normal', '', NOW())
			 RETURNING id`,
			orgID, contactID, channelID,
		).Scan(&conversationID)
		if err != nil {
			return nil, fmt.Errorf("failed to create conversation for echo: %w", err)
		}
	}

	// Skip if a recent agent message with same content exists (sent from Repliq)
	var existingID int64
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM messages
		 WHERE conversation_id = $1 AND sender_type = 'agent' AND content = $2
		   AND created_at > NOW() - INTERVAL '30 seconds'
		 LIMIT 1`,
		conversationID, msg.Content,
	).Scan(&existingID)
	if err == nil {
		// Already exists from Repliq send, skip
		return nil, fmt.Errorf("echo: duplicate of recent agent message %d", existingID)
	}

	// Save as agent message
	contentType := msg.ContentType
	if contentType == "" {
		contentType = "text"
	}
	var messageID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, content, content_type, external_id)
		 VALUES ($1, 'agent', $2, $3, $4)
		 RETURNING id`,
		conversationID, msg.Content, contentType, msg.ExternalID,
	).Scan(&messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to save echo message: %w", err)
	}

	for _, att := range msg.Attachments {
		_, err = s.db.Pool.Exec(ctx,
			`INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size)
			 VALUES ($1, $2, $3, $4, $5)`,
			messageID, att.FileName, att.FileURL, att.FileType, att.FileSize,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert echo attachment: %w", err)
		}
	}

	now := time.Now()
	s.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $1,
		 first_response_at = COALESCE(first_response_at, $1)
		 WHERE id = $2`,
		now, conversationID,
	)

	s.recordJourney(orgID, contactID, messageID, "message_out", channelType, msg.Content)

	return &HandleResult{
		ConversationID: conversationID,
		MessageID:      messageID,
		ContactID:      contactID,
		OrgID:          orgID,
	}, nil
}

func (s *Service) SendReply(ctx context.Context, conversationID int64, senderID int64, content string) (int64, error) {
	return s.SendReplyWithAttachments(ctx, conversationID, senderID, content, nil)
}

// SendReplyWithAttachments delivers a reply and embeds uploaded files where the
// channel supports it (currently email). Attachments with empty Data are ignored.
func (s *Service) SendReplyWithAttachments(ctx context.Context, conversationID int64, senderID int64, content string, attachments []IncomingAttachment) (int64, error) {
	// Get conversation details
	var channelID int64
	var contactExternalID string
	var channelType string
	var credsStr string
	var orgID int64
	var contactID int64
	var convSubject string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT c.channel_id, co.external_id, ch.type, COALESCE(ch.credentials::text, '{}'), c.org_id, c.contact_id, COALESCE(c.subject, '')
		 FROM conversations c
		 JOIN contacts co ON co.id = c.contact_id
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.id = $1`,
		conversationID,
	).Scan(&channelID, &contactExternalID, &channelType, &credsStr, &orgID, &contactID, &convSubject)
	if err != nil {
		return 0, fmt.Errorf("conversation not found: %w", err)
	}

	// Send via channel provider (load credentials from DB)
	if channelType != "livechat" {
		var creds map[string]string
		json.Unmarshal([]byte(credsStr), &creds)
		provider := s.registry.CreateProvider(channelType, creds)
		if provider != nil {
			if channelType == "email" {
				if ep, ok := provider.(EmailSender); ok {
					opts := s.buildEmailReplyOptions(ctx, conversationID, convSubject)
					if _, err = ep.SendEmail(ctx, contactExternalID, content, opts, attachments); err != nil {
						return 0, fmt.Errorf("failed to send email: %w", err)
					}
				} else if _, err = provider.SendMessage(ctx, contactExternalID, content, attachments); err != nil {
					return 0, fmt.Errorf("failed to send message via %s: %w", channelType, err)
				}
			} else if _, err = provider.SendMessage(ctx, contactExternalID, content, attachments); err != nil {
				return 0, fmt.Errorf("failed to send message via %s: %w", channelType, err)
			}
		}
	}

	// Save message
	var messageID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, sender_id, content, content_type)
		 VALUES ($1, 'agent', $2, $3, 'text')
		 RETURNING id`,
		conversationID, senderID, content,
	).Scan(&messageID)
	if err != nil {
		return 0, fmt.Errorf("failed to save message: %w", err)
	}

	// Persist attachments alongside the agent message so the UI shows what was sent.
	for _, att := range attachments {
		_, _ = s.db.Pool.Exec(ctx,
			`INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size)
			 VALUES ($1, $2, $3, $4, $5)`,
			messageID, att.FileName, att.FileURL, att.FileType, att.FileSize,
		)
	}

	// Update conversation
	now := time.Now()
	_, err = s.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $1,
		 first_response_at = COALESCE(first_response_at, $1)
		 WHERE id = $2`,
		now, conversationID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to update conversation: %w", err)
	}

	s.recordJourney(orgID, contactID, messageID, "message_out", channelType, content)

	return messageID, nil
}

// buildEmailReplyOptions derives Subject/In-Reply-To/References from the latest
// inbound message in the thread so outbound replies stay in the same Gmail thread.
func (s *Service) buildEmailReplyOptions(ctx context.Context, conversationID int64, convSubject string) EmailSendOptions {
	subject := strings.TrimSpace(convSubject)
	if subject == "" {
		subject = "Mesaj"
	}
	lower := strings.ToLower(subject)
	if !strings.HasPrefix(lower, "re:") && !strings.HasPrefix(lower, "fw:") && !strings.HasPrefix(lower, "fwd:") {
		subject = "Re: " + subject
	}

	opts := EmailSendOptions{Subject: subject}

	var lastInbound string
	_ = s.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(external_id, '') FROM messages
		 WHERE conversation_id = $1 AND sender_type = 'contact' AND external_id <> ''
		 ORDER BY created_at DESC LIMIT 1`,
		conversationID,
	).Scan(&lastInbound)
	if lastInbound != "" {
		opts.InReplyTo = lastInbound
		opts.References = []string{lastInbound}
	}
	return opts
}

// StartEmailConversation creates a contact + open conversation + outbound
// message for a brand-new outbound email, sends it via SMTP, and returns the IDs.
func (s *Service) StartEmailConversation(ctx context.Context, channelID int64, senderID int64, toEmail, toName, subject, body string, attachments []IncomingAttachment) (*HandleResult, error) {
	var orgID int64
	var channelType string
	var credsStr string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT org_id, type, COALESCE(credentials::text,'{}') FROM channels WHERE id = $1 AND is_active = true`,
		channelID,
	).Scan(&orgID, &channelType, &credsStr)
	if err != nil {
		return nil, fmt.Errorf("channel not found: %w", err)
	}
	if channelType != "email" {
		return nil, fmt.Errorf("StartEmailConversation: channel %d is not email", channelID)
	}

	name := strings.TrimSpace(toName)
	if name == "" {
		name = extractNameFromEmail(toEmail)
	}

	var contactID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO contacts (org_id, external_id, channel_type, name, email)
		 VALUES ($1, $2, 'email', $3, $2)
		 ON CONFLICT (org_id, channel_type, external_id) DO UPDATE
		 SET name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE contacts.name END,
		     email = COALESCE(NULLIF(EXCLUDED.email,''), contacts.email)
		 RETURNING id`,
		orgID, toEmail, name,
	).Scan(&contactID)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert contact: %w", err)
	}

	subj := strings.TrimSpace(subject)
	if subj == "" {
		subj = "Mesaj"
	}

	var conversationID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO conversations (org_id, channel_id, contact_id, status, priority, subject, last_message_at)
		 VALUES ($1, $2, $3, 'open', 'normal', $4, NOW())
		 RETURNING id`,
		orgID, channelID, contactID, subj,
	).Scan(&conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	var creds map[string]string
	json.Unmarshal([]byte(credsStr), &creds)
	provider := s.registry.CreateProvider("email", creds)
	ep, ok := provider.(EmailSender)
	if !ok || ep == nil {
		return nil, fmt.Errorf("email provider unavailable")
	}
	externalID, err := ep.SendEmail(ctx, toEmail, body, EmailSendOptions{Subject: subj}, attachments)
	if err != nil {
		return nil, fmt.Errorf("failed to send email: %w", err)
	}

	var messageID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, sender_id, content, content_type, external_id)
		 VALUES ($1, 'agent', $2, $3, 'text', $4)
		 RETURNING id`,
		conversationID, senderID, body, externalID,
	).Scan(&messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert message: %w", err)
	}
	for _, att := range attachments {
		_, _ = s.db.Pool.Exec(ctx,
			`INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size)
			 VALUES ($1, $2, $3, $4, $5)`,
			messageID, att.FileName, att.FileURL, att.FileType, att.FileSize,
		)
	}

	now := time.Now()
	_, _ = s.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $1,
		 first_response_at = COALESCE(first_response_at, $1)
		 WHERE id = $2`,
		now, conversationID,
	)

	s.recordJourney(orgID, contactID, messageID, "message_out", "email", body)

	return &HandleResult{
		ConversationID: conversationID,
		MessageID:      messageID,
		ContactID:      contactID,
		OrgID:          orgID,
		IsNew:          true,
	}, nil
}

func extractNameFromEmail(addr string) string {
	i := strings.IndexByte(addr, '@')
	if i <= 0 {
		return addr
	}
	return addr[:i]
}

// SendAttachment sends an uploaded file to the conversation's channel (Telegram, Instagram, etc.).
// content is used as caption/text. Returns the channel-side external message id (may be empty).
func (s *Service) SendAttachment(ctx context.Context, conversationID int64, content string, att IncomingAttachment) (string, error) {
	var contactExternalID string
	var channelType string
	var credsStr string
	var convSubject string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT co.external_id, ch.type, COALESCE(ch.credentials::text, '{}'), COALESCE(c.subject,'')
		 FROM conversations c
		 JOIN contacts co ON co.id = c.contact_id
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.id = $1`,
		conversationID,
	).Scan(&contactExternalID, &channelType, &credsStr, &convSubject)
	if err != nil {
		return "", fmt.Errorf("conversation not found: %w", err)
	}

	if channelType == "livechat" {
		return "", nil
	}

	var creds map[string]string
	json.Unmarshal([]byte(credsStr), &creds)
	provider := s.registry.CreateProvider(channelType, creds)
	if provider == nil {
		return "", fmt.Errorf("no provider for channel %s", channelType)
	}

	if channelType == "email" {
		if ep, ok := provider.(EmailSender); ok {
			body := content
			if body == "" {
				body = att.FileName
			}
			opts := s.buildEmailReplyOptions(ctx, conversationID, convSubject)
			return ep.SendEmail(ctx, contactExternalID, body, opts, []IncomingAttachment{att})
		}
	}

	return provider.SendMessage(ctx, contactExternalID, content, []IncomingAttachment{att})
}
