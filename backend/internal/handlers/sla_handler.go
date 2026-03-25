package handlers

import (
	"context"
	"math"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type SLAHandler struct {
	db *database.DB
}

func NewSLAHandler(db *database.DB) *SLAHandler {
	return &SLAHandler{db: db}
}

func (h *SLAHandler) GetPolicy(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var isEnabled, bhOnly bool
	var frU, frH, frN, frL, resU, resH, resN, resL int
	err := h.db.Pool.QueryRow(ctx,
		`SELECT is_enabled, first_response_urgent, first_response_high, first_response_normal, first_response_low,
		        resolution_urgent, resolution_high, resolution_normal, resolution_low, business_hours_only
		 FROM sla_policies WHERE org_id = $1`, orgID,
	).Scan(&isEnabled, &frU, &frH, &frN, &frL, &resU, &resH, &resN, &resL, &bhOnly)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"sla_policy": gin.H{
				"is_enabled":             false,
				"first_response_urgent":  5,
				"first_response_high":    15,
				"first_response_normal":  60,
				"first_response_low":     240,
				"resolution_urgent":      60,
				"resolution_high":        240,
				"resolution_normal":      1440,
				"resolution_low":         4320,
				"business_hours_only":    false,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sla_policy": gin.H{
			"is_enabled":             isEnabled,
			"first_response_urgent":  frU,
			"first_response_high":    frH,
			"first_response_normal":  frN,
			"first_response_low":     frL,
			"resolution_urgent":      resU,
			"resolution_high":        resH,
			"resolution_normal":      resN,
			"resolution_low":         resL,
			"business_hours_only":    bhOnly,
		},
	})
}

func (h *SLAHandler) SavePolicy(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		IsEnabled            bool `json:"is_enabled"`
		FirstResponseUrgent  int  `json:"first_response_urgent"`
		FirstResponseHigh    int  `json:"first_response_high"`
		FirstResponseNormal  int  `json:"first_response_normal"`
		FirstResponseLow     int  `json:"first_response_low"`
		ResolutionUrgent     int  `json:"resolution_urgent"`
		ResolutionHigh       int  `json:"resolution_high"`
		ResolutionNormal     int  `json:"resolution_normal"`
		ResolutionLow        int  `json:"resolution_low"`
		BusinessHoursOnly    bool `json:"business_hours_only"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := h.db.Pool.Exec(ctx,
		`INSERT INTO sla_policies (org_id, is_enabled, first_response_urgent, first_response_high, first_response_normal, first_response_low,
		  resolution_urgent, resolution_high, resolution_normal, resolution_low, business_hours_only)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 ON CONFLICT (org_id) DO UPDATE SET
		  is_enabled=$2, first_response_urgent=$3, first_response_high=$4, first_response_normal=$5, first_response_low=$6,
		  resolution_urgent=$7, resolution_high=$8, resolution_normal=$9, resolution_low=$10, business_hours_only=$11, updated_at=NOW()`,
		orgID, req.IsEnabled, req.FirstResponseUrgent, req.FirstResponseHigh, req.FirstResponseNormal, req.FirstResponseLow,
		req.ResolutionUrgent, req.ResolutionHigh, req.ResolutionNormal, req.ResolutionLow, req.BusinessHoursOnly,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saved"})
}

// GetConversationsSLA returns SLA status for all open conversations
func (h *SLAHandler) GetConversationsSLA(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Load SLA policy
	var isEnabled bool
	var frU, frH, frN, frL, resU, resH, resN, resL int
	err := h.db.Pool.QueryRow(ctx,
		`SELECT is_enabled, first_response_urgent, first_response_high, first_response_normal, first_response_low,
		        resolution_urgent, resolution_high, resolution_normal, resolution_low
		 FROM sla_policies WHERE org_id = $1`, orgID,
	).Scan(&isEnabled, &frU, &frH, &frN, &frL, &resU, &resH, &resN, &resL)

	if err != nil || !isEnabled {
		c.JSON(http.StatusOK, gin.H{"sla_statuses": map[string]interface{}{}, "enabled": false})
		return
	}

	frMap := map[string]int{"urgent": frU, "high": frH, "normal": frN, "low": frL}
	resMap := map[string]int{"urgent": resU, "high": resH, "normal": resN, "low": resL}

	rows, err := h.db.Pool.Query(ctx,
		`SELECT id, priority, status, created_at, first_response_at, resolved_at
		 FROM conversations WHERE org_id = $1 AND status IN ('open', 'pending')
		 ORDER BY created_at DESC LIMIT 100`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}
	defer rows.Close()

	now := time.Now()
	statuses := map[int64]interface{}{}

	for rows.Next() {
		var id int64
		var priority, status string
		var createdAt time.Time
		var firstResponseAt, resolvedAt *time.Time
		if err := rows.Scan(&id, &priority, &status, &createdAt, &firstResponseAt, &resolvedAt); err != nil {
			continue
		}

		frTarget := frMap[priority]
		resTarget := resMap[priority]
		if frTarget == 0 {
			frTarget = 60
		}
		if resTarget == 0 {
			resTarget = 1440
		}

		var respElapsed float64
		respBreached := false
		if firstResponseAt != nil {
			respElapsed = firstResponseAt.Sub(createdAt).Minutes()
		} else {
			respElapsed = now.Sub(createdAt).Minutes()
		}
		respElapsed = math.Round(respElapsed*10) / 10
		if respElapsed > float64(frTarget) {
			respBreached = true
		}

		var resElapsed float64
		resBreached := false
		if resolvedAt != nil {
			resElapsed = resolvedAt.Sub(createdAt).Minutes()
		} else {
			resElapsed = now.Sub(createdAt).Minutes()
		}
		resElapsed = math.Round(resElapsed*10) / 10
		if resElapsed > float64(resTarget) {
			resBreached = true
		}

		statuses[id] = gin.H{
			"response_target":    frTarget,
			"response_elapsed":   respElapsed,
			"response_breached":  respBreached,
			"response_met":       firstResponseAt != nil && !respBreached,
			"resolution_target":  resTarget,
			"resolution_elapsed": resElapsed,
			"resolution_breached": resBreached,
		}
	}

	c.JSON(http.StatusOK, gin.H{"sla_statuses": statuses, "enabled": true})
}
