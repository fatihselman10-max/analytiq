package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
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

	// Fetch attachments for all messages
	if len(messages) > 0 {
		msgIDs := make([]int64, len(messages))
		msgMap := make(map[int64]int)
		for i, m := range messages {
			msgIDs[i] = m.ID
			msgMap[m.ID] = i
		}

		attRows, err := h.db.Pool.Query(ctx,
			`SELECT message_id, COALESCE(file_name, ''), COALESCE(file_url, ''), COALESCE(file_type, ''), file_size
			 FROM attachments WHERE message_id = ANY($1)`,
			msgIDs,
		)
		if err == nil {
			defer attRows.Close()
			for attRows.Next() {
				var msgID int64
				var att models.Attachment
				if err := attRows.Scan(&msgID, &att.FileName, &att.FileURL, &att.FileType, &att.FileSize); err == nil {
					if idx, ok := msgMap[msgID]; ok {
						messages[idx].Attachments = append(messages[idx].Attachments, att)
					}
				}
			}
		}
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

func (h *MessageHandler) Upload(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	userID := c.GetInt64("user_id")
	conversationID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid conversation ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var convOrgID int64
	err = h.db.Pool.QueryRow(ctx,
		`SELECT org_id FROM conversations WHERE id = $1`, conversationID,
	).Scan(&convOrgID)
	if err != nil || convOrgID != orgID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 10MB)"})
		return
	}

	fileData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	content := c.PostForm("content")
	fileName := header.Filename
	fileType := header.Header.Get("Content-Type")
	if fileType == "" {
		fileType = "application/octet-stream"
	}

	contentType := "file"
	if strings.HasPrefix(fileType, "image/") {
		contentType = "image"
	}

	msgContent := content
	if msgContent == "" {
		msgContent = fileName
	}

	var messageID int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_type, sender_id, content, content_type, is_internal)
		 VALUES ($1, 'agent', $2, $3, $4, false)
		 RETURNING id`,
		conversationID, userID, msgContent, contentType,
	).Scan(&messageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create message"})
		return
	}

	var attachmentID int64
	err = h.db.Pool.QueryRow(ctx,
		`INSERT INTO attachments (message_id, file_name, file_url, file_type, file_size, file_data)
		 VALUES ($1, $2, '', $3, $4, $5)
		 RETURNING id`,
		messageID, fileName, fileType, header.Size, fileData,
	).Scan(&attachmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save attachment"})
		return
	}

	fileURL := fmt.Sprintf("/api/v1/files/%d", attachmentID)
	h.db.Pool.Exec(ctx, `UPDATE attachments SET file_url = $1 WHERE id = $2`, fileURL, attachmentID)

	// Forward the attachment to the underlying channel (Telegram, Instagram, etc.)
	if _, sendErr := h.channelService.SendAttachment(ctx, conversationID, content, channel.IncomingAttachment{
		FileName: fileName,
		FileType: fileType,
		FileSize: header.Size,
		Data:     fileData,
	}); sendErr != nil {
		fmt.Printf("[UPLOAD] channel send failed (msg=%d, conv=%d): %v\n", messageID, conversationID, sendErr)
	}

	h.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
		conversationID,
	)

	h.hub.BroadcastToOrg(orgID, ws.Event{
		Type: "new_message",
		Data: map[string]interface{}{
			"conversation_id": conversationID,
			"message_id":      messageID,
			"sender_type":     "agent",
			"content_type":    contentType,
			"content":         msgContent,
		},
	})

	c.JSON(http.StatusCreated, gin.H{
		"message_id":    messageID,
		"attachment_id": attachmentID,
		"file_url":      fileURL,
	})
}

func (h *MessageHandler) ServeFile(c *gin.Context) {
	attachmentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachment ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var fileName, fileType string
	var fileData []byte
	err = h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(file_name, ''), COALESCE(file_type, 'application/octet-stream'), file_data
		 FROM attachments WHERE id = $1 AND file_data IS NOT NULL`,
		attachmentID,
	).Scan(&fileName, &fileType, &fileData)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.Header("Content-Type", fileType)
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, fileName))
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, fileType, fileData)
}
