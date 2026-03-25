package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type AutomationHandler struct {
	db *database.DB
}

func NewAutomationHandler(db *database.DB) *AutomationHandler {
	return &AutomationHandler{db: db}
}

func (h *AutomationHandler) List(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, org_id, name, is_active, trigger_type,
		        COALESCE(conditions::text,'[]'), COALESCE(actions::text,'[]'),
		        execution_count, last_executed_at, created_at, updated_at
		 FROM automations WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	type automationResponse struct {
		ID             int64       `json:"id"`
		Name           string      `json:"name"`
		IsActive       bool        `json:"is_active"`
		TriggerType    string      `json:"trigger_type"`
		Conditions     interface{} `json:"conditions"`
		Actions        interface{} `json:"actions"`
		ExecutionCount int         `json:"execution_count"`
		LastExecutedAt *time.Time  `json:"last_executed_at"`
		CreatedAt      time.Time   `json:"created_at"`
	}

	items := []automationResponse{}
	for rows.Next() {
		var a automationResponse
		var condStr, actStr string
		if err := rows.Scan(&a.ID, new(int64), &a.Name, &a.IsActive, &a.TriggerType,
			&condStr, &actStr, &a.ExecutionCount, &a.LastExecutedAt, &a.CreatedAt, new(time.Time)); err == nil {
			json.Unmarshal([]byte(condStr), &a.Conditions)
			json.Unmarshal([]byte(actStr), &a.Actions)
			items = append(items, a)
		}
	}

	c.JSON(http.StatusOK, gin.H{"automations": items})
}

func (h *AutomationHandler) Create(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		Name        string      `json:"name" binding:"required"`
		TriggerType string      `json:"trigger_type" binding:"required"`
		Conditions  interface{} `json:"conditions"`
		Actions     interface{} `json:"actions" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	condJSON, _ := json.Marshal(req.Conditions)
	actJSON, _ := json.Marshal(req.Actions)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var id int64
	err := h.db.Pool.QueryRow(ctx,
		`INSERT INTO automations (org_id, name, trigger_type, conditions, actions)
		 VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING id`,
		orgID, req.Name, req.TriggerType, string(condJSON), string(actJSON),
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *AutomationHandler) Update(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Name        string      `json:"name"`
		TriggerType string      `json:"trigger_type"`
		Conditions  interface{} `json:"conditions"`
		Actions     interface{} `json:"actions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	condJSON, _ := json.Marshal(req.Conditions)
	actJSON, _ := json.Marshal(req.Actions)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`UPDATE automations SET name=$1, trigger_type=$2, conditions=$3::jsonb, actions=$4::jsonb, updated_at=NOW()
		 WHERE id=$5 AND org_id=$6`,
		req.Name, req.TriggerType, string(condJSON), string(actJSON), id, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *AutomationHandler) Delete(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx, `DELETE FROM automations WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *AutomationHandler) Toggle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	h.db.Pool.Exec(ctx,
		`UPDATE automations SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 AND org_id=$2`, id, orgID)
	c.JSON(http.StatusOK, gin.H{"message": "Toggled"})
}

// RunAutomations executes matching automations for a trigger event
func RunAutomations(db *database.DB, ctx context.Context, orgID int64, triggerType string,
	conversationID int64, channelType string, messageContent string, priority string, status string) {

	rows, err := db.Pool.Query(ctx,
		`SELECT id, COALESCE(conditions::text,'[]'), COALESCE(actions::text,'[]')
		 FROM automations WHERE org_id=$1 AND trigger_type=$2 AND is_active=true`,
		orgID, triggerType)
	if err != nil {
		return
	}
	defer rows.Close()

	type condition struct {
		Field    string `json:"field"`
		Operator string `json:"operator"`
		Value    string `json:"value"`
	}
	type action struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	}

	for rows.Next() {
		var autoID int64
		var condStr, actStr string
		if err := rows.Scan(&autoID, &condStr, &actStr); err != nil {
			continue
		}

		var conditions []condition
		var actions []action
		json.Unmarshal([]byte(condStr), &conditions)
		json.Unmarshal([]byte(actStr), &actions)

		// Check all conditions
		match := true
		for _, cond := range conditions {
			var fieldVal string
			switch cond.Field {
			case "channel_type":
				fieldVal = channelType
			case "message_content":
				fieldVal = strings.ToLower(messageContent)
				cond.Value = strings.ToLower(cond.Value)
			case "priority":
				fieldVal = priority
			case "status":
				fieldVal = status
			}

			switch cond.Operator {
			case "equals":
				if fieldVal != cond.Value {
					match = false
				}
			case "not_equals":
				if fieldVal == cond.Value {
					match = false
				}
			case "contains":
				if !strings.Contains(fieldVal, cond.Value) {
					match = false
				}
			}
			if !match {
				break
			}
		}

		if !match {
			continue
		}

		// Execute actions
		for _, act := range actions {
			switch act.Type {
			case "assign_agent":
				agentID, _ := strconv.ParseInt(act.Value, 10, 64)
				if agentID > 0 {
					db.Pool.Exec(ctx, `UPDATE conversations SET assigned_to=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
						agentID, conversationID, orgID)
				}
			case "set_priority":
				db.Pool.Exec(ctx, `UPDATE conversations SET priority=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
					act.Value, conversationID, orgID)
			case "set_status":
				db.Pool.Exec(ctx, `UPDATE conversations SET status=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
					act.Value, conversationID, orgID)
			case "add_tag":
				tagID, _ := strconv.ParseInt(act.Value, 10, 64)
				if tagID > 0 {
					db.Pool.Exec(ctx, `INSERT INTO conversation_tags (conversation_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
						conversationID, tagID)
				}
			case "send_message":
				if act.Value != "" {
					db.Pool.Exec(ctx,
						`INSERT INTO messages (conversation_id, sender_type, content, content_type)
						 VALUES ($1, 'bot', $2, 'text')`, conversationID, act.Value)
				}
			}
		}

		// Update execution stats
		db.Pool.Exec(ctx,
			`UPDATE automations SET execution_count = execution_count + 1, last_executed_at = NOW() WHERE id=$1`,
			autoID)
	}
}
