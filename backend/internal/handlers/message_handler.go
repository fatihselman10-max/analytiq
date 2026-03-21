package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/models"
	"github.com/repliq/backend/internal/services/channel"
	"github.com/repliq/backend/internal/ws"
	"github.com/gin-gonic/gin"
)

type MessageHandler struct {
	db             *database.DB
	channelService *channel.Service
	hub            *ws.Hub
}

func NewMessageHandler(db *database.DB, channelService *channel.Service, hub *ws.Hub) *MessageHandler {
	return &MessageHandler{db: db, channelService: channelService, hub: hub}
}

func (h *MessageHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	conversationID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Verify conversation belongs to org
	var convOrgID int64
	err = h.db.Pool.QueryRow(ctx,
		`SELECT org_id FROM conversations WHERE id = $1`, conversationID,
	).Scan(&convOrgID)
	if err != nil || convOrgID != orgID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT m.id, m.conversation_id, m.sender_type, m.sender_id, m.content,
		        m.content_type, m.is_internal, COALESCE(m.external_id, ''), m.created_at,
		        COALESCE(u.full_name, co.name, '') AS sender_name
		 FROM messages m
		 LEFT JOIN users u ON m.sender_type IN ('agent', 'bot') AND u.id = m.sender_id
		 LEFT JOIN conversations cv ON cv.id = m.conversation_id
		 LEFT JOIN contacts co ON m.sender_type = 'contact' AND co.id = cv.contact_id
		 WHERE m.conversation_id = $1
		 ORDER BY m.created_at ASC`,
		conversationID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var msg models.Message
		err := rows.Scan(
			&msg.ID, &msg.ConversationID, &msg.SenderType, &msg.SenderID,
			&msg.Content, &msg.ContentType, &msg.IsInternal, &msg.ExternalID,
			&msg.CreatedAt, &msg.SenderName,
		)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (h *MessageHandler) Reply(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	conversationID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Verify conversation belongs to org
	var convOrgID int64
	err = h.db.Pool.QueryRow(ctx,
		`SELECT org_id FROM conversations WHERE id = $1`, conversationID,
	).Scan(&convOrgID)
	if err != nil || convOrgID != orgID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	messageID, err := h.channelService.SendReply(ctx, conversationID, userID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Broadcast via WebSocket
	h.hub.BroadcastToOrg(orgID, ws.Event{
		Type: "new_message",
		Data: map[string]interface{}{
			"conversation_id": conversationID,
			"message_id":      messageID,
			"sender_type":     "agent",
			"content":         req.Content,
		},
	})

	c.JSON(http.StatusCreated, gin.H{"message_id": messageID})
}

func (h *MessageHandler) AddNote(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	conversationID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Verify conversation belongs to org
	var convOrgID int64
	err = h.db.Pool.QueryRow(ctx,
		`SELECT org_id FROM conversations WHERE id = $1`, conversationID,
	).Scan(&convOrgID)
	if err != nil || convOrgID != orgID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	var messageID int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, sender_id, content, content_type, is_internal)
		 VALUES ($1, 'agent', $2, $3, 'note', true)
		 RETURNING id`,
		conversationID, userID, req.Content,
	).Scan(&messageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add note"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message_id": messageID})
}
