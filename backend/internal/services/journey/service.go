package journey

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
)

type Service struct {
	db *database.DB
}

func NewService(db *database.DB) *Service { return &Service{db: db} }

type Event struct {
	ID          int64           `json:"id"`
	OrgID       int64           `json:"org_id"`
	ContactID   *int64          `json:"contact_id,omitempty"`
	EventType   string          `json:"event_type"`
	Source      string          `json:"source"`
	Title       string          `json:"title"`
	Body        string          `json:"body"`
	Metadata    json.RawMessage `json:"metadata"`
	AmountCents *int64          `json:"amount_cents,omitempty"`
	Currency    *string         `json:"currency,omitempty"`
	ExternalID  *string         `json:"external_id,omitempty"`
	OccurredAt  time.Time       `json:"occurred_at"`
	CreatedAt   time.Time       `json:"created_at"`
}

type InsertParams struct {
	OrgID       int64
	ContactID   int64 // 0 => NULL
	EventType   string
	Source      string
	Title       string
	Body        string
	Metadata    map[string]interface{}
	AmountCents *int64
	Currency    string
	ExternalID  string
	OccurredAt  *time.Time
}

func (s *Service) Insert(ctx context.Context, p InsertParams) (int64, error) {
	metaJSON := []byte("{}")
	if p.Metadata != nil {
		if b, err := json.Marshal(p.Metadata); err == nil {
			metaJSON = b
		}
	}
	var contactID *int64
	if p.ContactID != 0 {
		cid := p.ContactID
		contactID = &cid
	}
	var currency *string
	if p.Currency != "" {
		cur := p.Currency
		currency = &cur
	}
	var extID *string
	if p.ExternalID != "" {
		ext := p.ExternalID
		extID = &ext
	}
	occurredAt := time.Now()
	if p.OccurredAt != nil {
		occurredAt = *p.OccurredAt
	}

	var id int64
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO customer_events
		   (org_id, contact_id, event_type, source, title, body, metadata,
		    amount_cents, currency, external_id, occurred_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
		 RETURNING id`,
		p.OrgID, contactID, p.EventType, p.Source, p.Title, p.Body, string(metaJSON),
		p.AmountCents, currency, extID, occurredAt,
	).Scan(&id)
	return id, err
}

func (s *Service) ListByContact(ctx context.Context, orgID, contactID int64, limit int) ([]Event, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, org_id, contact_id, event_type, source, title, body,
		        COALESCE(metadata::text, '{}'),
		        amount_cents, currency, external_id, occurred_at, created_at
		 FROM customer_events
		 WHERE org_id = $1 AND contact_id = $2
		 ORDER BY occurred_at DESC
		 LIMIT $3`, orgID, contactID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		var metaStr string
		if err := rows.Scan(&e.ID, &e.OrgID, &e.ContactID, &e.EventType, &e.Source,
			&e.Title, &e.Body, &metaStr, &e.AmountCents, &e.Currency, &e.ExternalID,
			&e.OccurredAt, &e.CreatedAt); err != nil {
			continue
		}
		e.Metadata = json.RawMessage(metaStr)
		events = append(events, e)
	}
	return events, nil
}

// FindOrCreateContactByEmail looks up an existing contact for this org whose
// email (case-insensitive) matches. On miss, creates a new contact with
// channel_type='shopify' so it doesn't collide with per-channel external_id rows.
func (s *Service) FindOrCreateContactByEmail(ctx context.Context, orgID int64, email, name, phone string) (int64, error) {
	if email == "" {
		return 0, fmt.Errorf("email required for upsert")
	}
	normalized := strings.ToLower(strings.TrimSpace(email))

	var id int64
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id FROM contacts
		 WHERE org_id = $1 AND LOWER(COALESCE(email, '')) = $2
		 ORDER BY updated_at DESC LIMIT 1`,
		orgID, normalized,
	).Scan(&id)
	if err == nil {
		// Backfill name/phone if we have them and row is blank
		if name != "" || phone != "" {
			_, _ = s.db.Pool.Exec(ctx,
				`UPDATE contacts SET
				   name = CASE WHEN COALESCE(name,'') = '' AND $2 != '' THEN $2 ELSE name END,
				   phone = CASE WHEN COALESCE(phone,'') = '' AND $3 != '' THEN $3 ELSE phone END,
				   updated_at = NOW()
				 WHERE id = $1`,
				id, name, phone)
		}
		return id, nil
	}

	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO contacts (org_id, external_id, channel_type, name, email, phone)
		 VALUES ($1, $2, 'shopify', $3, $2, $4)
		 RETURNING id`,
		orgID, normalized, name, phone,
	).Scan(&id)
	return id, err
}

// Truncate returns s clipped to max runes, safe for multi-byte Turkish strings.
func Truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}
