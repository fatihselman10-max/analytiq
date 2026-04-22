package email

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/repliq/backend/internal/database"
	channelpkg "github.com/repliq/backend/internal/services/channel"
)

// Manager owns the lifecycle of IMAP pollers keyed by channel ID. The settings
// UI calls Refresh/Remove when credentials change so we don't need a backend
// restart to pick up new App Passwords.
type Manager struct {
	db             *database.DB
	channelService *channelpkg.Service
	mu             sync.Mutex
	pollers        map[int64]*IMAPPoller
}

func NewManager(db *database.DB, cs *channelpkg.Service) *Manager {
	return &Manager{
		db:             db,
		channelService: cs,
		pollers:        make(map[int64]*IMAPPoller),
	}
}

// BootstrapAll loads every active email channel from the DB and starts a
// poller for each. Safe to call at app boot.
func (m *Manager) BootstrapAll(ctx context.Context) {
	rows, err := m.db.Pool.Query(ctx,
		`SELECT id, COALESCE(credentials::text, '{}') FROM channels
		 WHERE type = 'email' AND is_active = true
		   AND credentials IS NOT NULL AND credentials::text NOT IN ('{}','null')`)
	if err != nil {
		log.Printf("[EMAIL-MGR] bootstrap query failed: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var credsStr string
		if err := rows.Scan(&id, &credsStr); err != nil {
			continue
		}
		var creds map[string]string
		if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
			continue
		}
		if creds["imap_host"] == "" || creds["smtp_user"] == "" {
			continue
		}
		m.mu.Lock()
		m.startLocked(id, creds)
		m.mu.Unlock()
	}
}

// Refresh stops any existing poller for this channel, reloads credentials from
// the DB, and starts a fresh poller. Call this after updating credentials.
func (m *Manager) Refresh(ctx context.Context, channelID int64) error {
	var credsStr string
	var isActive bool
	err := m.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(credentials::text, '{}'), is_active FROM channels
		 WHERE id = $1 AND type = 'email'`,
		channelID,
	).Scan(&credsStr, &isActive)
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if existing, ok := m.pollers[channelID]; ok {
		existing.Stop()
		delete(m.pollers, channelID)
	}
	if !isActive {
		return nil
	}
	var creds map[string]string
	if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
		return err
	}
	if creds["imap_host"] == "" || creds["smtp_user"] == "" {
		return nil
	}
	m.startLocked(channelID, creds)
	return nil
}

// Remove stops and drops the poller for this channel without touching the DB.
func (m *Manager) Remove(channelID int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing, ok := m.pollers[channelID]; ok {
		existing.Stop()
		delete(m.pollers, channelID)
	}
}

func (m *Manager) startLocked(channelID int64, creds map[string]string) {
	p := NewIMAPPoller(m.db, m.channelService, channelID, creds)
	m.pollers[channelID] = p
	go p.Start()
	log.Printf("[EMAIL-MGR] started poller for channel %d (%s)", channelID, creds["smtp_user"])
}
