package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type BusinessHoursHandler struct {
	db *database.DB
}

func NewBusinessHoursHandler(db *database.DB) *BusinessHoursHandler {
	return &BusinessHoursHandler{db: db}
}

func (h *BusinessHoursHandler) Get(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var bh models.BusinessHours
	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, org_id, is_enabled, COALESCE(timezone, 'Europe/Istanbul'),
		        COALESCE(schedule::text, '{}'), COALESCE(away_message, ''), COALESCE(welcome_message, ''),
		        created_at, updated_at
		 FROM business_hours WHERE org_id = $1`, orgID,
	).Scan(&bh.ID, &bh.OrgID, &bh.IsEnabled, &bh.Timezone, &bh.Schedule, &bh.AwayMessage, &bh.WelcomeMessage, &bh.CreatedAt, &bh.UpdatedAt)

	if err != nil {
		// Return default config if not exists
		c.JSON(http.StatusOK, gin.H{
			"business_hours": gin.H{
				"is_enabled":      false,
				"timezone":        "Europe/Istanbul",
				"schedule":        defaultSchedule(),
				"away_message":    "Şu anda mesai saatleri dışındayız. En kısa sürede size dönüş yapacağız.",
				"welcome_message": "",
			},
		})
		return
	}

	// Parse schedule JSON to return as object
	var schedule interface{}
	if err := json.Unmarshal([]byte(bh.Schedule), &schedule); err != nil {
		schedule = defaultSchedule()
	}

	c.JSON(http.StatusOK, gin.H{
		"business_hours": gin.H{
			"id":              bh.ID,
			"is_enabled":      bh.IsEnabled,
			"timezone":        bh.Timezone,
			"schedule":        schedule,
			"away_message":    bh.AwayMessage,
			"welcome_message": bh.WelcomeMessage,
		},
	})
}

func (h *BusinessHoursHandler) Save(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	var req struct {
		IsEnabled      bool        `json:"is_enabled"`
		Timezone       string      `json:"timezone"`
		Schedule       interface{} `json:"schedule"`
		AwayMessage    string      `json:"away_message"`
		WelcomeMessage string      `json:"welcome_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scheduleJSON, err := json.Marshal(req.Schedule)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid schedule format"})
		return
	}

	if req.Timezone == "" {
		req.Timezone = "Europe/Istanbul"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err = h.db.Pool.Exec(ctx,
		`INSERT INTO business_hours (org_id, is_enabled, timezone, schedule, away_message, welcome_message)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6)
		 ON CONFLICT (org_id) DO UPDATE SET
		   is_enabled = $2, timezone = $3, schedule = $4::jsonb,
		   away_message = $5, welcome_message = $6, updated_at = NOW()`,
		orgID, req.IsEnabled, req.Timezone, string(scheduleJSON), req.AwayMessage, req.WelcomeMessage,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saved"})
}

func (h *BusinessHoursHandler) Toggle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var isEnabled bool
	err := h.db.Pool.QueryRow(ctx,
		`SELECT is_enabled FROM business_hours WHERE org_id = $1`, orgID,
	).Scan(&isEnabled)
	if err != nil {
		// Create default and enable
		schedule, _ := json.Marshal(defaultSchedule())
		h.db.Pool.Exec(ctx,
			`INSERT INTO business_hours (org_id, is_enabled, schedule, away_message)
			 VALUES ($1, true, $2::jsonb, $3)`,
			orgID, string(schedule), "Şu anda mesai saatleri dışındayız. En kısa sürede size dönüş yapacağız.")
		c.JSON(http.StatusOK, gin.H{"is_enabled": true})
		return
	}

	h.db.Pool.Exec(ctx,
		`UPDATE business_hours SET is_enabled = $1, updated_at = NOW() WHERE org_id = $2`,
		!isEnabled, orgID)

	c.JSON(http.StatusOK, gin.H{"is_enabled": !isEnabled})
}

// IsOutsideBusinessHours checks if current time is outside business hours for an org
func IsOutsideBusinessHours(db *database.DB, ctx context.Context, orgID int64) (bool, string) {
	var isEnabled bool
	var tz, scheduleStr, awayMsg string
	err := db.Pool.QueryRow(ctx,
		`SELECT is_enabled, COALESCE(timezone, 'Europe/Istanbul'),
		        COALESCE(schedule::text, '{}'), COALESCE(away_message, '')
		 FROM business_hours WHERE org_id = $1`, orgID,
	).Scan(&isEnabled, &tz, &scheduleStr, &awayMsg)
	if err != nil || !isEnabled {
		return false, ""
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.FixedZone("TRT", 3*60*60)
	}
	now := time.Now().In(loc)

	dayNames := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	dayName := dayNames[now.Weekday()]

	var schedule map[string]models.DaySchedule
	if err := json.Unmarshal([]byte(scheduleStr), &schedule); err != nil {
		return false, ""
	}

	day, ok := schedule[dayName]
	if !ok || !day.Enabled {
		return true, awayMsg
	}

	currentTime := now.Format("15:04")
	if currentTime < day.Start || currentTime >= day.End {
		return true, awayMsg
	}

	return false, ""
}

func defaultSchedule() map[string]models.DaySchedule {
	return map[string]models.DaySchedule{
		"monday":    {Enabled: true, Start: "09:00", End: "18:00"},
		"tuesday":   {Enabled: true, Start: "09:00", End: "18:00"},
		"wednesday": {Enabled: true, Start: "09:00", End: "18:00"},
		"thursday":  {Enabled: true, Start: "09:00", End: "18:00"},
		"friday":    {Enabled: true, Start: "09:00", End: "18:00"},
		"saturday":  {Enabled: false, Start: "10:00", End: "14:00"},
		"sunday":    {Enabled: false, Start: "", End: ""},
	}
}
