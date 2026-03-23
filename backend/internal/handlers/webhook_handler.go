package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/bot"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/services/channel/instagram"
	"github.com/repliq/backend/internal/ws"
	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	db             *database.DB
	channelService *channel.Service
	registry       *channel.Registry
	botEngine      *bot.Engine
	aiBot          *bot.AIBot
	hub            *ws.Hub
}

func NewWebhookHandler(db *database.DB, channelService *channel.Service, registry *channel.Registry, botEngine *bot.Engine, aiBot *bot.AIBot, hub *ws.Hub) *WebhookHandler {
	return &WebhookHandler{db: db, channelService: channelService, registry: registry, botEngine: botEngine, aiBot: aiBot, hub: hub}
}

// loadProviderFromDB loads a channel provider with credentials from the database
func (h *WebhookHandler) loadProviderFromDB(ctx context.Context, channelType string) (channel.Provider, int64, error) {
	var channelID int64
	var credsStr string
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, COALESCE(credentials::text, '{}') FROM channels WHERE type = $1 AND is_active = true LIMIT 1`,
		channelType,
	).Scan(&channelID, &credsStr)
	if err != nil {
		fmt.Printf("[WEBHOOK] failed to load channel %s: %v\n", channelType, err)
		return nil, 0, err
	}

	var creds map[string]string
	if err := json.Unmarshal([]byte(credsStr), &creds); err != nil {
		creds = make(map[string]string)
	}

	var provider channel.Provider
	switch channelType {
	case "instagram":
		provider = instagram.NewInstagramProvider(creds)
	default:
		// Fallback to registry for other types
		p, err := h.registry.Get(channelType)
		if err != nil {
			return nil, channelID, nil
		}
		return p, channelID, nil
	}

	return provider, channelID, nil
}

func (h *WebhookHandler) HandleWebhook(channelType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		defer cancel()

		// Load provider with credentials from DB
		provider, channelID, err := h.loadProviderFromDB(ctx, channelType)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "No active channel found"})
			return
		}

		if provider == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported channel"})
			return
		}

		headers := make(map[string]string)
		for key := range c.Request.Header {
			headers[key] = c.GetHeader(key)
		}

		msg, err := provider.ParseWebhook(ctx, body, headers)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse webhook: " + err.Error()})
			return
		}

		if msg.IsEcho {
			// Echo message: sent by our page, save as agent message in existing conversation
			result, err := h.channelService.HandleEchoMessage(ctx, channelID, msg)
			if err != nil {
				// No matching conversation found is OK - just ignore
				c.JSON(http.StatusOK, gin.H{"status": "ok", "echo": "skipped"})
				return
			}

			h.hub.BroadcastToOrg(result.OrgID, ws.Event{
				Type: "new_message",
				Data: map[string]interface{}{
					"conversation_id": result.ConversationID,
					"message_id":      result.MessageID,
					"sender_type":     "agent",
					"content":         msg.Content,
				},
			})
			c.JSON(http.StatusOK, gin.H{"status": "ok", "echo": "saved"})
			return
		}

		result, err := h.channelService.HandleIncomingMessage(ctx, channelID, msg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process message: " + err.Error()})
			return
		}

		// Try keyword bot first, then AI bot
		var chType string
		h.db.Pool.QueryRow(ctx, `SELECT type FROM channels WHERE id = $1`, channelID).Scan(&chType)
		_, matched, _ := h.botEngine.ProcessMessage(ctx, result.OrgID, result.ConversationID, msg.Content, chType)
		if !matched && h.aiBot != nil {
			h.aiBot.ProcessMessage(ctx, result.OrgID, result.ConversationID, msg.Content, chType)
		}

		// Broadcast via WebSocket
		h.hub.BroadcastToOrg(result.OrgID, ws.Event{
			Type: "new_message",
			Data: map[string]interface{}{
				"conversation_id": result.ConversationID,
				"message_id":      result.MessageID,
				"sender_type":     "contact",
				"content":         msg.Content,
				"is_new":          result.IsNew,
			},
		})

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
}

func (h *WebhookHandler) VerifyWebhook(c *gin.Context) {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token != "" {
		c.String(http.StatusOK, challenge)
		return
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Verification failed"})
}

func (h *WebhookHandler) HandleLiveChatMessage(c *gin.Context) {
	var req struct {
		ChannelID int64  `json:"channel_id" binding:"required"`
		SenderID  string `json:"sender_id" binding:"required"`
		Name      string `json:"name"`
		Content   string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := &channel.IncomingMessage{
		ExternalID:  "lc-" + strconv.FormatInt(req.ChannelID, 10) + "-" + req.SenderID,
		SenderID:    req.SenderID,
		SenderName:  req.Name,
		Content:     req.Content,
		ContentType: "text",
	}

	result, err := h.channelService.HandleIncomingMessage(c.Request.Context(), req.ChannelID, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process message"})
		return
	}

	var chType string
	h.db.Pool.QueryRow(c.Request.Context(), `SELECT type FROM channels WHERE id = $1`, req.ChannelID).Scan(&chType)
	_, lcMatched, _ := h.botEngine.ProcessMessage(c.Request.Context(), result.OrgID, result.ConversationID, req.Content, chType)
	if !lcMatched && h.aiBot != nil {
		h.aiBot.ProcessMessage(c.Request.Context(), result.OrgID, result.ConversationID, req.Content, chType)
	}

	h.hub.BroadcastToOrg(result.OrgID, ws.Event{
		Type: "new_message",
		Data: map[string]interface{}{
			"conversation_id": result.ConversationID,
			"message_id":      result.MessageID,
			"sender_type":     "contact",
			"content":         req.Content,
			"is_new":          result.IsNew,
		},
	})

	c.JSON(http.StatusOK, gin.H{
		"conversation_id": result.ConversationID,
		"message_id":      result.MessageID,
	})
}
