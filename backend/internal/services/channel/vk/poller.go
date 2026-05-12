package vk

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/ws"
)

// Poller fetches new VK community DMs via messages.getConversations + messages.getHistory.
// Acts as a backup to the webhook so missed events still get reconciled into the panel.
type Poller struct {
	db             *database.DB
	channelService *channel.Service
	hub            *ws.Hub
	httpClient     *http.Client

	channelID   int64
	orgID       int64
	accessToken string
	groupID     string
}

func NewPoller(db *database.DB, channelService *channel.Service, hub *ws.Hub) *Poller {
	return &Poller{
		db:             db,
		channelService: channelService,
		hub:            hub,
		httpClient:     &http.Client{Timeout: 20 * time.Second},
	}
}

func (p *Poller) Start(interval time.Duration) {
	if !p.loadConfig() {
		log.Println("[VK-POLLER] No active VK channel with credentials, poller disabled")
		return
	}
	log.Printf("[VK-POLLER] Started polling every %v for org=%d channel=%d", interval, p.orgID, p.channelID)
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
		`SELECT id, org_id, COALESCE(credentials::text, '{}') FROM channels WHERE type = 'vk' AND is_active = true LIMIT 1`,
	).Scan(&p.channelID, &p.orgID, &credsStr)
	if err != nil {
		log.Printf("[VK-POLLER] no active vk channel row: %v", err)
		return false
	}
	var creds map[string]string
	if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
		log.Printf("[VK-POLLER] credentials JSON parse: %v", err)
		return false
	}
	keys := make([]string, 0, len(creds))
	for k := range creds {
		keys = append(keys, k)
	}
	log.Printf("[VK-POLLER] channel=%d creds keys: %v", p.channelID, keys)

	p.accessToken = creds["access_token"]
	if p.accessToken == "" {
		p.accessToken = os.Getenv("VK_TOKEN")
	}
	p.groupID = creds["group_id"]
	if p.groupID == "" {
		p.groupID = os.Getenv("VK_GROUP_ID")
	}
	if p.accessToken == "" {
		log.Println("[VK-POLLER] no access_token in creds or env")
		return false
	}
	return true
}

type vkConversation struct {
	Conversation struct {
		Peer struct {
			ID int64 `json:"id"`
		} `json:"peer"`
		LastMessageID int64 `json:"last_message_id"`
	} `json:"conversation"`
	LastMessage vkMessage `json:"last_message"`
}

type vkMessage struct {
	ID         int64  `json:"id"`
	Date       int64  `json:"date"`
	FromID     int64  `json:"from_id"`
	PeerID     int64  `json:"peer_id"`
	Text       string `json:"text"`
	OutSelf    int    `json:"out"` // 1 if sent by community
}

type vkUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	ScreenName string `json:"screen_name"`
}

func (p *Poller) poll() {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	convs, err := p.fetchConversations(ctx)
	if err != nil {
		log.Printf("[VK-POLLER] getConversations failed: %v", err)
		return
	}
	imported := 0
	for _, c := range convs {
		peerID := c.Conversation.Peer.ID
		// Fetch last few messages per peer
		msgs, err := p.fetchHistory(ctx, peerID, 20)
		if err != nil {
			log.Printf("[VK-POLLER] history peer=%d failed: %v", peerID, err)
			continue
		}
		for _, m := range msgs {
			if p.importMessage(ctx, m) {
				imported++
			}
		}
	}
	if imported > 0 {
		log.Printf("[VK-POLLER] imported %d new messages from %d conversations", imported, len(convs))
	}
}

func (p *Poller) fetchConversations(ctx context.Context) ([]vkConversation, error) {
	params := url.Values{}
	params.Set("count", "50")
	params.Set("filter", "all")
	params.Set("access_token", p.accessToken)
	params.Set("v", "5.199")
	apiURL := "https://api.vk.com/method/messages.getConversations?" + params.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Response struct {
			Items []vkConversation `json:"items"`
		} `json:"response"`
		Error *struct {
			ErrorCode int    `json:"error_code"`
			ErrorMsg  string `json:"error_msg"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Error != nil {
		return nil, fmt.Errorf("vk error %d: %s", result.Error.ErrorCode, result.Error.ErrorMsg)
	}
	return result.Response.Items, nil
}

func (p *Poller) fetchHistory(ctx context.Context, peerID int64, count int) ([]vkMessage, error) {
	params := url.Values{}
	params.Set("peer_id", strconv.FormatInt(peerID, 10))
	params.Set("count", strconv.Itoa(count))
	params.Set("rev", "0")
	params.Set("access_token", p.accessToken)
	params.Set("v", "5.199")
	apiURL := "https://api.vk.com/method/messages.getHistory?" + params.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Response struct {
			Items []vkMessage `json:"items"`
		} `json:"response"`
		Error *struct {
			ErrorCode int    `json:"error_code"`
			ErrorMsg  string `json:"error_msg"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Error != nil {
		return nil, fmt.Errorf("vk error %d: %s", result.Error.ErrorCode, result.Error.ErrorMsg)
	}
	return result.Response.Items, nil
}

func (p *Poller) fetchUserName(ctx context.Context, userID int64) string {
	if userID <= 0 {
		return ""
	}
	params := url.Values{}
	params.Set("user_ids", strconv.FormatInt(userID, 10))
	params.Set("fields", "screen_name")
	params.Set("access_token", p.accessToken)
	params.Set("v", "5.199")
	apiURL := "https://api.vk.com/method/users.get?" + params.Encode()
	req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Response []vkUser `json:"response"`
	}
	json.Unmarshal(body, &result)
	if len(result.Response) == 0 {
		return ""
	}
	u := result.Response[0]
	full := (u.FirstName + " " + u.LastName)
	if full == " " {
		return u.ScreenName
	}
	return full
}

func (p *Poller) importMessage(ctx context.Context, m vkMessage) bool {
	extID := strconv.FormatInt(m.ID, 10)

	var exists bool
	p.db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM messages WHERE external_id = $1)`, extID,
	).Scan(&exists)
	if exists {
		return false
	}

	// out=1 means sent by community → agent message; otherwise contact message.
	if m.OutSelf == 1 {
		var convID int64
		err := p.db.Pool.QueryRow(ctx,
			`SELECT c.id FROM conversations c
			 JOIN contacts ct ON c.contact_id = ct.id
			 WHERE ct.external_id = $1 AND ct.channel_type = 'vk' AND ct.org_id = $2
			 ORDER BY c.id DESC LIMIT 1`,
			strconv.FormatInt(m.PeerID, 10), p.orgID).Scan(&convID)
		if err != nil {
			return false
		}
		content := m.Text
		if content == "" {
			content = "[Medya]"
		}
		_, err = p.db.Pool.Exec(ctx,
			`INSERT INTO messages (conversation_id, sender_type, content, content_type, external_id, created_at)
			 VALUES ($1, 'agent', $2, 'text', $3, to_timestamp($4)) ON CONFLICT DO NOTHING`,
			convID, content, extID, m.Date)
		return err == nil
	}

	// Contact message — route through channelService so AnalyzeIncoming runs.
	senderID := strconv.FormatInt(m.FromID, 10)
	senderName := p.fetchUserName(ctx, m.FromID)
	if senderName == "" {
		senderName = "vk_" + senderID
	}
	content := m.Text
	if content == "" {
		content = "[Medya]"
	}
	incoming := &channel.IncomingMessage{
		ExternalID:  extID,
		SenderID:    senderID,
		SenderName:  senderName,
		Content:     content,
		ContentType: "text",
	}
	result, err := p.channelService.HandleIncomingMessage(ctx, p.channelID, incoming)
	if err != nil {
		log.Printf("[VK-POLLER] handle msg %d failed: %v", m.ID, err)
		return false
	}
	if m.Date > 0 {
		p.db.Pool.Exec(ctx,
			`UPDATE messages SET created_at = to_timestamp($1) WHERE id = $2`, m.Date, result.MessageID)
	}
	if p.hub != nil {
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
	}
	return true
}
