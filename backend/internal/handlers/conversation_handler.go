package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type ConversationHandler struct {
	db *database.DB
}

func NewConversationHandler(db *database.DB) *ConversationHandler {
	return &ConversationHandler{db: db}
}

func (h *ConversationHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := `
		SELECT c.id, c.org_id, c.channel_id, c.contact_id, c.assigned_to,
		       c.status, c.priority, c.subject, c.last_message_at,
		       c.first_response_at, c.resolved_at, c.created_at, c.updated_at,
		       co.name AS contact_name, co.email AS contact_email, co.avatar_url AS contact_avatar,
		       ch.type AS channel_type,
		       u.full_name AS assigned_name,
		       COALESCE((SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), c.subject) AS last_message
		FROM conversations c
		LEFT JOIN contacts co ON co.id = c.contact_id
		LEFT JOIN channels ch ON ch.id = c.channel_id
		LEFT JOIN users u ON u.id = c.assigned_to
		WHERE c.org_id = $1`

	args := []interface{}{orgID}
	argIdx := 2

	if status := c.Query("status"); status != "" {
		query += fmt.Sprintf(" AND c.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if assignedTo := c.Query("assigned_to"); assignedTo != "" {
		query += fmt.Sprintf(" AND c.assigned_to = $%d", argIdx)
		args = append(args, assignedTo)
		argIdx++
	}
	if channelID := c.Query("channel_id"); channelID != "" {
		query += fmt.Sprintf(" AND c.channel_id = $%d", argIdx)
		args = append(args, channelID)
		argIdx++
	}
	if priority := c.Query("priority"); priority != "" {
		query += fmt.Sprintf(" AND c.priority = $%d", argIdx)
		args = append(args, priority)
		argIdx++
	}
	if search := c.Query("search"); search != "" {
		query += fmt.Sprintf(" AND (c.subject ILIKE $%d OR co.name ILIKE $%d OR co.email ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += " ORDER BY c.last_message_at DESC NULLS LAST LIMIT 50"

	rows, err := h.db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch conversations"})
		return
	}
	defer rows.Close()

	conversations := []models.Conversation{}
	for rows.Next() {
		var conv models.Conversation
		var contactName, contactEmail, contactAvatar, channelType, assignedName, lastMessage *string
		err := rows.Scan(
			&conv.ID, &conv.OrgID, &conv.ChannelID, &conv.ContactID, &conv.AssignedTo,
			&conv.Status, &conv.Priority, &conv.Subject, &conv.LastMessageAt,
			&conv.FirstResponseAt, &conv.ResolvedAt, &conv.CreatedAt, &conv.UpdatedAt,
			&contactName, &contactEmail, &contactAvatar,
			&channelType,
			&assignedName,
			&lastMessage,
		)
		if err != nil {
			continue
		}
		if contactName != nil {
			conv.Contact = &models.Contact{Name: *contactName}
			if contactEmail != nil {
				conv.Contact.Email = *contactEmail
			}
			if contactAvatar != nil {
				conv.Contact.AvatarURL = *contactAvatar
			}
		}
		if channelType != nil {
			conv.ChannelType = *channelType
		}
		if assignedName != nil {
			conv.AssignedUser = &models.User{FullName: *assignedName}
		}
		if lastMessage != nil {
			conv.LastMessage = *lastMessage
		}
		conversations = append(conversations, conv)
	}

	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

func (h *ConversationHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var conv models.Conversation
	var contactName, contactEmail, contactAvatar, channelType, assignedName *string
	err = h.db.Pool.QueryRow(ctx,
		`SELECT c.id, c.org_id, c.channel_id, c.contact_id, c.assigned_to,
		        c.status, c.priority, c.subject, c.last_message_at,
		        c.first_response_at, c.resolved_at, c.created_at, c.updated_at,
		        co.name, co.email, co.avatar_url,
		        ch.type,
		        u.full_name
		 FROM conversations c
		 LEFT JOIN contacts co ON co.id = c.contact_id
		 LEFT JOIN channels ch ON ch.id = c.channel_id
		 LEFT JOIN users u ON u.id = c.assigned_to
		 WHERE c.id = $1 AND c.org_id = $2`,
		id, orgID,
	).Scan(
		&conv.ID, &conv.OrgID, &conv.ChannelID, &conv.ContactID, &conv.AssignedTo,
		&conv.Status, &conv.Priority, &conv.Subject, &conv.LastMessageAt,
		&conv.FirstResponseAt, &conv.ResolvedAt, &conv.CreatedAt, &conv.UpdatedAt,
		&contactName, &contactEmail, &contactAvatar,
		&channelType,
		&assignedName,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	if contactName != nil {
		conv.Contact = &models.Contact{Name: *contactName}
		if contactEmail != nil {
			conv.Contact.Email = *contactEmail
		}
		if contactAvatar != nil {
			conv.Contact.AvatarURL = *contactAvatar
		}
	}
	if channelType != nil {
		conv.ChannelType = *channelType
	}
	if assignedName != nil {
		conv.AssignedUser = &models.User{FullName: *assignedName}
	}

	// Get tags
	tagRows, err := h.db.Pool.Query(ctx,
		`SELECT t.id, t.name, t.color FROM tags t
		 JOIN conversation_tags ct ON ct.tag_id = t.id
		 WHERE ct.conversation_id = $1`, id)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tag models.Tag
			if err := tagRows.Scan(&tag.ID, &tag.Name, &tag.Color); err == nil {
				conv.Tags = append(conv.Tags, tag)
			}
		}
	}

	c.JSON(http.StatusOK, conv)
}

func (h *ConversationHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Status     *string `json:"status"`
		Priority   *string `json:"priority"`
		AssignedTo *int64  `json:"assigned_to"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if req.Status != nil {
		resolvedAt := "resolved_at"
		if *req.Status == "resolved" {
			_, err = h.db.Pool.Exec(ctx,
				`UPDATE conversations SET status = $1, resolved_at = NOW(), updated_at = NOW()
				 WHERE id = $2 AND org_id = $3`, *req.Status, id, orgID)
		} else {
			_ = resolvedAt
			_, err = h.db.Pool.Exec(ctx,
				`UPDATE conversations SET status = $1, updated_at = NOW()
				 WHERE id = $2 AND org_id = $3`, *req.Status, id, orgID)
		}
	}
	if req.Priority != nil {
		_, err = h.db.Pool.Exec(ctx,
			`UPDATE conversations SET priority = $1, updated_at = NOW()
			 WHERE id = $2 AND org_id = $3`, *req.Priority, id, orgID)
	}
	if req.AssignedTo != nil {
		_, err = h.db.Pool.Exec(ctx,
			`UPDATE conversations SET assigned_to = $1, updated_at = NOW()
			 WHERE id = $2 AND org_id = $3`, *req.AssignedTo, id, orgID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *ConversationHandler) BulkUpdate(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		IDs        []int64 `json:"ids" binding:"required"`
		Status     *string `json:"status"`
		Priority   *string `json:"priority"`
		AssignedTo *int64  `json:"assigned_to"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "1-100 arası konuşma seçilebilir"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	updated := 0
	for _, id := range req.IDs {
		if req.Status != nil {
			if *req.Status == "resolved" {
				h.db.Pool.Exec(ctx, `UPDATE conversations SET status=$1, resolved_at=NOW(), updated_at=NOW() WHERE id=$2 AND org_id=$3`, *req.Status, id, orgID)
			} else {
				h.db.Pool.Exec(ctx, `UPDATE conversations SET status=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`, *req.Status, id, orgID)
			}
		}
		if req.Priority != nil {
			h.db.Pool.Exec(ctx, `UPDATE conversations SET priority=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`, *req.Priority, id, orgID)
		}
		if req.AssignedTo != nil {
			h.db.Pool.Exec(ctx, `UPDATE conversations SET assigned_to=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`, *req.AssignedTo, id, orgID)
		}
		updated++
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%d konuşma güncellendi", updated)})
}

func (h *ConversationHandler) Assign(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		UserID int64 `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE conversations SET assigned_to = $1, updated_at = NOW()
		 WHERE id = $2 AND org_id = $3`, req.UserID, id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Assigned"})
}

func (h *ConversationHandler) AddTag(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		TagID int64 `json:"tag_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Verify tag belongs to org
	var tagOrgID int64
	err = h.db.Pool.QueryRow(ctx, `SELECT org_id FROM tags WHERE id = $1`, req.TagID).Scan(&tagOrgID)
	if err != nil || tagOrgID != orgID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tag not found"})
		return
	}

	_, err = h.db.Pool.Exec(ctx,
		`INSERT INTO conversation_tags (conversation_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		id, req.TagID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add tag"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag added"})
}

func (h *ConversationHandler) RemoveTag(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	tagID, err := strconv.ParseInt(c.Param("tag_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tag ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`DELETE FROM conversation_tags WHERE conversation_id = $1 AND tag_id = $2`,
		id, tagID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove tag"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag removed"})
}
