package instagram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/ws"
)

// Poller periodically fetches Instagram DMs via the Conversations API
type Poller struct {
	db             *database.DB
	channelService *channel.Service
	hub            *ws.Hub
	pageID         string
	pageToken      string
	igAccountID    string
	channelID      int64
	orgID          int64
	httpClient     *http.Client
	lastPollTime   time.Time
}

// NewPoller creates a new Instagram DM poller
func NewPoller(db *database.DB, channelService *channel.Service, hub *ws.Hub) *Poller {
	return &Poller{
		db:             db,
		channelService: channelService,
		hub:            hub,
		httpClient:     &http.Client{Timeout: 60 * time.Second},
		lastPollTime:   time.Now().Add(-24 * time.Hour), // start by fetching last 24h
	}
}

// Start begins polling Instagram DMs
func (p *Poller) Start(interval time.Duration) {
	// Load channel config from DB
	if !p.loadConfig() {
		log.Println("[IG-POLLER] No active Instagram channel found, poller disabled")
		return
	}

	log.Printf("[IG-POLLER] Started polling every %v for org=%d channel=%d", interval, p.orgID, p.channelID)

	// Initial poll
	p.poll()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		p.poll()
	}
}

func (p *Poller) loadConfig() bool {
	ctx := context.Background()

	var credsStr string
	err := p.db.Pool.QueryRow(ctx,
		`SELECT id, org_id, COALESCE(credentials::text, '{}') FROM channels WHERE type = 'instagram' AND is_active = true LIMIT 1`,
	).Scan(&p.channelID, &p.orgID, &credsStr)
	if err != nil {
		return false
	}

	var creds map[string]string
	if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
		return false
	}

	p.igAccountID = creds["page_id"]

	// Use fb_page_id if available
	if fbPageID := creds["fb_page_id"]; fbPageID != "" {
		p.pageID = fbPageID
	}

	// Use page_access_token if available, otherwise fall back to access_token
	if pageToken := creds["page_access_token"]; pageToken != "" {
		p.pageToken = pageToken
	} else {
		p.pageToken = creds["access_token"]
	}

	if p.pageToken == "" {
		log.Println("[IG-POLLER] No access token in channel credentials")
		return false
	}

	// If we still don't have a page ID, try to get it
	if p.pageID == "" {
		p.loadPageID()
	}

	return p.pageToken != "" && p.pageID != ""
}

func (p *Poller) loadPageID() {
	// Try to get page ID via me/accounts using the token
	url := fmt.Sprintf("%s/me/accounts?access_token=%s", fbGraphAPIBase, p.pageToken)
	resp, err := p.httpClient.Get(url)
	if err != nil {
		log.Printf("[IG-POLLER] Failed to get page ID: %v", err)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Data []struct {
			ID          string `json:"id"`
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil || len(result.Data) == 0 {
		// Token might already be a page token, try using it directly
		url2 := fmt.Sprintf("%s/me?fields=id&access_token=%s", fbGraphAPIBase, p.pageToken)
		resp2, err2 := p.httpClient.Get(url2)
		if err2 != nil {
			return
		}
		defer resp2.Body.Close()
		body2, _ := io.ReadAll(resp2.Body)
		var me struct {
			ID string `json:"id"`
		}
		json.Unmarshal(body2, &me)
		if me.ID != "" {
			p.pageID = me.ID
			log.Printf("[IG-POLLER] Using page token directly, page_id=%s", p.pageID)
		}
		return
	}

	p.pageID = result.Data[0].ID
	// Use the page-level token for better permissions
	if result.Data[0].AccessToken != "" {
		p.pageToken = result.Data[0].AccessToken
	}
	log.Printf("[IG-POLLER] Got page_id=%s", p.pageID)
}

type igConversation struct {
	ID string `json:"id"`
}

type igMessage struct {
	ID        string `json:"id"`
	Message   string `json:"message"`
	From      struct {
		Name     string `json:"name"`
		Username string `json:"username"`
		ID       string `json:"id"`
	} `json:"from"`
	To struct {
		Data []struct {
			Name     string `json:"name"`
			Username string `json:"username"`
			ID       string `json:"id"`
		} `json:"data"`
	} `json:"to"`
	CreatedTime string `json:"created_time"`
}

func (p *Poller) poll() {
	if p.pageID == "" {
		log.Println("[IG-POLLER] No page ID, skipping poll")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	// Get conversations - minimal fields to avoid timeout
	url := fmt.Sprintf("%s/%s/conversations?platform=instagram&fields=id&limit=10&access_token=%s",
		fbGraphAPIBase, p.pageID, p.pageToken)

	convs, err := p.fetchConversations(ctx, url)
	if err != nil {
		log.Printf("[IG-POLLER] Conversations API unavailable (may need Advanced Access): %v", truncate(err.Error(), 150))
		return
	}

	newMessages := 0
	for _, conv := range convs {
		n := p.processConversation(ctx, conv)
		newMessages += n
	}

	if newMessages > 0 {
		log.Printf("[IG-POLLER] Imported %d new messages from %d conversations", newMessages, len(convs))
	}

	p.lastPollTime = time.Now()
}

func (p *Poller) fetchConversations(ctx context.Context, url string) ([]igConversation, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, truncate(string(body), 200))
	}

	var result struct {
		Data []igConversation `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (p *Poller) processConversation(ctx context.Context, conv igConversation) int {
	// Get messages for this conversation
	url := fmt.Sprintf("%s/%s?fields=messages.limit(10){message,from,to,created_time}&access_token=%s",
		fbGraphAPIBase, conv.ID, p.pageToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[IG-POLLER] Conv %s messages error %d: %s", conv.ID, resp.StatusCode, truncate(string(body), 200))
		return 0
	}

	var result struct {
		Messages struct {
			Data []igMessage `json:"data"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return 0
	}

	imported := 0
	// Process messages in reverse (oldest first)
	msgs := result.Messages.Data
	for i := len(msgs) - 1; i >= 0; i-- {
		msg := msgs[i]
		if p.importMessage(ctx, msg) {
			imported++
		}
	}

	return imported
}

func (p *Poller) importMessage(ctx context.Context, msg igMessage) bool {
	// Check if message already exists (by external_id)
	var exists bool
	p.db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM messages WHERE external_id = $1)`, msg.ID,
	).Scan(&exists)
	if exists {
		return false
	}

	// Determine if this is from the page (echo) or from a user
	isFromPage := msg.From.ID == p.pageID || msg.From.ID == p.igAccountID

	if isFromPage {
		// This is our own message - save as agent message
		// Find the recipient (the customer)
		if len(msg.To.Data) == 0 {
			return false
		}
		recipient := msg.To.Data[0]

		// Find existing conversation for this contact
		var convID int64
		err := p.db.Pool.QueryRow(ctx,
			`SELECT c.id FROM conversations c
			 JOIN contacts ct ON c.contact_id = ct.id
			 WHERE ct.external_id = $1 AND ct.channel_type = 'instagram' AND ct.org_id = $2
			 ORDER BY c.id DESC LIMIT 1`,
			recipient.ID, p.orgID,
		).Scan(&convID)
		if err != nil {
			// No conversation yet - will be created when customer message arrives
			return false
		}

		// Save agent message
		content := msg.Message
		if content == "" {
			content = "[Medya]"
		}
		createdAt, _ := time.Parse("2006-01-02T15:04:05-0700", msg.CreatedTime)
		if createdAt.IsZero() {
			createdAt = time.Now()
		}

		_, err = p.db.Pool.Exec(ctx,
			`INSERT INTO messages (conversation_id, sender_type, content, content_type, external_id, created_at)
			 VALUES ($1, 'agent', $2, 'text', $3, $4)
			 ON CONFLICT DO NOTHING`,
			convID, content, msg.ID, createdAt)
		return err == nil
	}

	// Customer message
	senderName := msg.From.Username
	if senderName == "" {
		senderName = msg.From.Name
	}
	if senderName == "" {
		senderName = "ig_" + msg.From.ID
	}

	content := msg.Message
	if content == "" {
		content = "[Medya]"
	}

	incomingMsg := &channel.IncomingMessage{
		ExternalID:  msg.ID,
		SenderID:    msg.From.ID,
		SenderName:  senderName,
		Content:     content,
		ContentType: "text",
	}

	result, err := p.channelService.HandleIncomingMessage(ctx, p.channelID, incomingMsg)
	if err != nil {
		log.Printf("[IG-POLLER] Failed to handle message %s: %v", msg.ID, err)
		return false
	}

	// Update message created_at to actual Instagram timestamp
	createdAt, _ := time.Parse("2006-01-02T15:04:05-0700", msg.CreatedTime)
	if !createdAt.IsZero() {
		p.db.Pool.Exec(ctx,
			`UPDATE messages SET created_at = $1 WHERE id = $2`,
			createdAt, result.MessageID)
	}

	// Broadcast
	p.hub.BroadcastToOrg(result.OrgID, ws.Event{
		Type: "new_message",
		Data: map[string]interface{}{
			"conversation_id": result.ConversationID,
			"message_id":      result.MessageID,
			"sender_type":     "contact",
			"content":         content,
			"is_new":          result.IsNew,
		},
	})

	return true
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
