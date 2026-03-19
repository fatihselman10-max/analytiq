package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// Event types
const (
	EventNewMessage          = "new_message"
	EventConversationUpdated = "conversation_updated"
	EventTyping              = "typing"
	EventAgentAssigned       = "agent_assigned"
)

// Client represents a single WebSocket connection.
type Client struct {
	Conn   *websocket.Conn
	OrgID  int64
	UserID int64
	Send   chan []byte
}

// Event represents a real-time event broadcast to clients.
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// Hub maintains the set of active clients grouped by orgID and broadcasts
// messages to clients within the same organization.
type Hub struct {
	clients    map[int64]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan orgEvent
	mu         sync.RWMutex
}

// orgEvent is an internal type used to route an event to an organization.
type orgEvent struct {
	OrgID int64
	Event Event
}

// NewHub creates and returns a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[int64]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan orgEvent, 256),
	}
}

// Run starts the hub's main event loop. It should be launched as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.OrgID] == nil {
				h.clients[client.OrgID] = make(map[*Client]bool)
			}
			h.clients[client.OrgID][client] = true
			h.mu.Unlock()
			log.Printf("ws: client registered org=%d user=%d", client.OrgID, client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.OrgID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.clients, client.OrgID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("ws: client unregistered org=%d user=%d", client.OrgID, client.UserID)

		case oe := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[oe.OrgID]
			h.mu.RUnlock()

			data, err := json.Marshal(oe.Event)
			if err != nil {
				log.Printf("ws: failed to marshal event: %v", err)
				continue
			}

			for client := range clients {
				select {
				case client.Send <- data:
				default:
					// Client's send buffer is full; drop the client.
					h.mu.Lock()
					delete(h.clients[oe.OrgID], client)
					close(client.Send)
					if len(h.clients[oe.OrgID]) == 0 {
						delete(h.clients, oe.OrgID)
					}
					h.mu.Unlock()
				}
			}
		}
	}
}

// Register adds a client to the hub.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// BroadcastToOrg sends an event to all connected clients in the given organization.
func (h *Hub) BroadcastToOrg(orgID int64, event Event) {
	h.broadcast <- orgEvent{OrgID: orgID, Event: event}
}

// ReadPump reads messages from the WebSocket connection. It handles client
// disconnection by unregistering from the hub when the connection closes.
func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws: read error org=%d user=%d: %v", c.OrgID, c.UserID, err)
			}
			break
		}
		// Inbound messages from the client are currently not processed;
		// extend here if client-to-server messaging is needed.
	}
}

// WritePump pumps messages from the Send channel to the WebSocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain any queued messages into the same write.
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
