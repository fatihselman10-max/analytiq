package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/bot"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/services/channel/instagram"
	tgpkg "github.com/repliq/backend/internal/services/channel/telegram"
	vkprovider "github.com/repliq/backend/internal/services/channel/vk"
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
	verifyToken    string
}

func NewWebhookHandler(db *database.DB, channelService *channel.Service, registry *channel.Registry, botEngine *bot.Engine, aiBot *bot.AIBot, hub *ws.Hub, verifyToken string) *WebhookHandler {
	return &WebhookHandler{db: db, channelService: channelService, registry: registry, botEngine: botEngine, aiBot: aiBot, hub: hub, verifyToken: verifyToken}
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
	case "telegram":
		provider = tgpkg.NewTelegramProvider(creds)
	case "vk":
		provider = vkprovider.NewVKProvider(creds)
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

		ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
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

		// VK confirmation event - return confirmation code
		if msg.ContentType == "confirmation" {
			c.String(http.StatusOK, msg.Content)
			return
		}

		// Telegram Business connection event - persist connection_id to channel credentials
		if msg.ContentType == "business_connection" {
			connID := ""
			if msg.Metadata != nil {
				connID = msg.Metadata["business_connection_id"]
			}
			h.db.Pool.Exec(ctx,
				`UPDATE channels
				 SET credentials = jsonb_set(COALESCE(credentials, '{}'::jsonb), '{business_connection_id}', to_jsonb($1::text), true)
				 WHERE id = $2`,
				connID, channelID)
			fmt.Printf("[TG-BUSINESS] Connection updated for channel %d: id=%q enabled=%s\n",
				channelID, connID, msg.Metadata["is_enabled"])
			c.JSON(http.StatusOK, gin.H{"status": "ok", "business_connection": "saved"})
			return
		}

		// Telegram: persist business_connection_id from the first business_message if not yet stored
		if channelType == "telegram" && msg.Metadata != nil {
			if connID := msg.Metadata["business_connection_id"]; connID != "" {
				if tg, ok := provider.(*tgpkg.Provider); ok && tg.BusinessConnectionID() == "" {
					h.db.Pool.Exec(ctx,
						`UPDATE channels
						 SET credentials = jsonb_set(COALESCE(credentials, '{}'::jsonb), '{business_connection_id}', to_jsonb($1::text), true)
						 WHERE id = $2`,
						connID, channelID)
					// Reload provider with the new connection id so the rest of this request can reply via business
					provider, _, _ = h.loadProviderFromDB(ctx, channelType)
				}
			}
		}

		// Telegram bot commands - auto-reply (skip for business messages)
		isBusinessMessage := msg.Metadata != nil && msg.Metadata["business_connection_id"] != ""
		if channelType == "telegram" && !isBusinessMessage {
			if tg, ok := provider.(*tgpkg.Provider); ok {
				tg.HandleBotCommands(ctx, msg.SenderID, msg.Content)
			}
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

		// Check business hours - send auto-reply if outside
		var chType string
		h.db.Pool.QueryRow(ctx, `SELECT type FROM channels WHERE id = $1`, channelID).Scan(&chType)

		outside, _ := IsOutsideBusinessHours(h.db, ctx, result.OrgID)
		if outside {
			// Find customer country for targeted auto-reply
			var customerCountry string
			if result.ConversationID > 0 {
				h.db.Pool.QueryRow(ctx,
					`SELECT COALESCE(cu.country, '') FROM conversations cv
					 LEFT JOIN customers cu ON cu.id = cv.customer_id
					 WHERE cv.id = $1`, result.ConversationID,
				).Scan(&customerCountry)
			}

			// Get best matching auto-reply (channel + country based)
			autoMsg := GetAutoReply(h.db, ctx, result.OrgID, chType, customerCountry)
			if autoMsg != "" {
				// Save as bot message
				h.db.Pool.Exec(ctx,
					`INSERT INTO messages (conversation_id, sender_type, content, content_type)
					 VALUES ($1, 'bot', $2, 'text')`,
					result.ConversationID, autoMsg)
				// Send via channel
				if provider != nil {
					provider.SendMessage(ctx, msg.SenderID, autoMsg, nil)
				}
			}
		}

		// Try keyword bot first, then AI bot
		_, matched, _ := h.botEngine.ProcessMessage(ctx, result.OrgID, result.ConversationID, msg.Content, chType)
		if !matched && h.aiBot != nil {
			// Check if AI bot is in test mode (only respond to specific senders)
			var testSenderIDs string
			h.db.Pool.QueryRow(ctx,
				`SELECT COALESCE(test_sender_ids, '') FROM ai_bot_config WHERE org_id = $1`, result.OrgID,
			).Scan(&testSenderIDs)

			aiAllowed := true
			if testSenderIDs != "" {
				aiAllowed = false
				for _, id := range splitAndTrim(testSenderIDs) {
					if id == msg.SenderID || id == msg.SenderName {
						aiAllowed = true
						break
					}
				}
				if !aiAllowed {
					fmt.Printf("[AI Bot] Skipping - sender %s (%s) not in test list\n", msg.SenderID, msg.SenderName)
				}
			}

			if aiAllowed {
				aiResp, aiResponded, _ := h.aiBot.ProcessMessage(ctx, result.OrgID, result.ConversationID, msg.Content, chType)
				if aiResponded && provider != nil {
					provider.SendMessage(ctx, msg.SenderID, aiResp, nil)
				}
			}
		}

		// Run automations
		triggerType := "message_received"
		if result.IsNew {
			triggerType = "new_conversation"
		}
		go RunAutomations(h.db, context.Background(), result.OrgID, triggerType,
			result.ConversationID, chType, msg.Content, "normal", "open")

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

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func (h *WebhookHandler) VerifyWebhook(c *gin.Context) {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token == h.verifyToken {
		fmt.Printf("[WEBHOOK] Verification successful for token: %s\n", token)
		c.String(http.StatusOK, challenge)
		return
	}

	fmt.Printf("[WEBHOOK] Verification failed - mode: %s, token: %s, expected: %s\n", mode, token, h.verifyToken)
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
