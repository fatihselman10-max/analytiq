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

	// Find existing open conversation or create new
	var conversationID int64
	isNew := false
	err = s.db.Pool.QueryRow(ctx,
		`SELECT id FROM conversations
		 WHERE org_id = $1 AND contact_id = $2 AND channel_id = $3 AND status IN ('open', 'pending')
		 ORDER BY created_at DESC LIMIT 1`,
		orgID, contactID, channelID,
	).Scan(&conversationID)
	if err != nil {
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

func (s *Service) SendReply(ctx context.Context, conversationID int64, senderID int64, content string) (int64, error) {
	// Get conversation details
	var channelID int64
	var contactExternalID string
	var channelType string
	var credsJSON []byte
	err := s.db.Pool.QueryRow(ctx,
		`SELECT c.channel_id, co.external_id, ch.type, ch.credentials
		 FROM conversations c
		 JOIN contacts co ON co.id = c.contact_id
		 JOIN channels ch ON ch.id = c.channel_id
		 WHERE c.id = $1`,
		conversationID,
	).Scan(&channelID, &contactExternalID, &channelType, &credsJSON)
	if err != nil {
		return 0, fmt.Errorf("conversation not found: %w", err)
	}

	// Send via channel provider (load credentials from DB)
	if channelType != "livechat" {
		var creds map[string]string
		if len(credsJSON) > 0 {
			json.Unmarshal(credsJSON, &creds)
		}
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
