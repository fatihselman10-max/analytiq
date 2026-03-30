package channel

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/repliq/backend/internal/database"
)

type Service struct {
	db       *database.DB
	registry *Registry
}

func NewService(db *database.DB, registry *Registry) *Service {
	return &Service{db: db, registry: registry}
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
				`UPDATE conversations SET status = 'open', resolved_at = NULL, updated_at = NOW() WHERE id = $1`,
				conversationID,
			)
		} else {
			// Create new conversation
			isNew = true
			subject := msg.Content
			if len(subject) > 100 {
				subject = subject[:100]
			}
			err = s.db.Pool.QueryRow(ctx,
				`INSERT INTO conversations (org_id, channel_id, contact_id, status, priority, subject, last_message_at)
				 VALUES ($1, $2, $3, 'open', 'normal', $4, NOW())
				 RETURNING id`,
				orgID, channelID, contactID, subject,
			).Scan(&conversationID)
			if err != nil {
				return nil, fmt.Errorf("failed to create conversation: %w", err)
			}
		}
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

	// Find the customer contact by recipient ID (the person we sent the message TO)
	var contactID int64
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM contacts WHERE org_id = $1 AND channel_type = $2 AND external_id = $3`,
		orgID, channelType, msg.RecipientID,
	).Scan(&contactID)
	if err != nil {
		return nil, fmt.Errorf("contact not found for echo: %w", err)
	}

	// Find the latest open/pending conversation for this contact
	var conversationID int64
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM conversations
		 WHERE org_id = $1 AND contact_id = $2 AND channel_id = $3 AND status IN ('open', 'pending')
		 ORDER BY last_message_at DESC LIMIT 1`,
		orgID, contactID, channelID,
	).Scan(&conversationID)
	if err != nil {
		return nil, fmt.Errorf("no open conversation for echo: %w", err)
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
	var messageID int64
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, content, content_type, external_id)
		 VALUES ($1, 'agent', $2, 'text', $3)
		 RETURNING id`,
		conversationID, msg.Content, msg.ExternalID,
	).Scan(&messageID)
	if err != nil {
		return nil, fmt.Errorf("failed to save echo message: %w", err)
	}

	now := time.Now()
	s.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $1,
		 first_response_at = COALESCE(first_response_at, $1),
		 status = 'resolved', resolved_at = $1
		 WHERE id = $2`,
		now, conversationID,
	)

	return &HandleResult{
		ConversationID: conversationID,
		MessageID:      messageID,
		ContactID:      contactID,
		OrgID:          orgID,
	}, nil
}

func (s *Service) SendReply(ctx context.Context, conversationID int64, senderID int64, content string) (int64, error) {
	// Get conversation details
	var channelID int64
	var contactExternalID string
	var channelType string
	var credsStr string
	err := s.db.Pool.QueryRow(ctx,
		`SELECT c.channel_id, co.external_id, ch.type, COALESCE(ch.credentials::text, '{}')
		 FROM conversations c
		 JOIN contacts co ON co.id = c.contact_id
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.id = $1`,
		conversationID,
	).Scan(&channelID, &contactExternalID, &channelType, &credsStr)
	if err != nil {
		return 0, fmt.Errorf("conversation not found: %w", err)
	}

	// Send via channel provider (load credentials from DB)
	if channelType != "livechat" {
		var creds map[string]string
		json.Unmarshal([]byte(credsStr), &creds)
		provider := s.registry.CreateProvider(channelType, creds)
		if provider != nil {
			_, err = provider.SendMessage(ctx, contactExternalID, content, nil)
			if err != nil {
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

	return messageID, nil
}
