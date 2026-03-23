package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/gin-gonic/gin"
)

type AIBotHandler struct {
	db *database.DB
}

func NewAIBotHandler(db *database.DB) *AIBotHandler {
	return &AIBotHandler{db: db}
}

func (h *AIBotHandler) GetConfig(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var config struct {
		ID                 int64  `json:"id"`
		OrgID              int64  `json:"org_id"`
		IsEnabled          bool   `json:"is_enabled"`
		BrandName          string `json:"brand_name"`
		BrandDescription   string `json:"brand_description"`
		BrandTone          string `json:"brand_tone"`
		ProductsServices   string `json:"products_services"`
		FAQ                string `json:"faq"`
		Policies           string `json:"policies"`
		GreetingMessage    string `json:"greeting_message"`
		FallbackMessage    string `json:"fallback_message"`
		CustomInstructions string `json:"custom_instructions"`
		TokenBalance       int    `json:"token_balance"`
		TokensUsed         int    `json:"tokens_used"`
	}

	err := h.db.Pool.QueryRow(ctx,
		`SELECT id, org_id, is_enabled, COALESCE(brand_name,''), COALESCE(brand_description,''),
		        COALESCE(brand_tone,'professional'), COALESCE(products_services,''), COALESCE(faq,''),
		        COALESCE(policies,''), COALESCE(greeting_message,''), COALESCE(fallback_message,''),
		        COALESCE(custom_instructions,''), token_balance, tokens_used
		 FROM ai_bot_config WHERE org_id = $1`, orgID,
	).Scan(&config.ID, &config.OrgID, &config.IsEnabled, &config.BrandName, &config.BrandDescription,
		&config.BrandTone, &config.ProductsServices, &config.FAQ, &config.Policies,
		&config.GreetingMessage, &config.FallbackMessage, &config.CustomInstructions,
		&config.TokenBalance, &config.TokensUsed)

	if err != nil {
		// No config yet, return empty
		c.JSON(http.StatusOK, gin.H{
			"is_enabled": false, "brand_name": "", "brand_description": "", "brand_tone": "professional",
			"products_services": "", "faq": "", "policies": "", "greeting_message": "",
			"fallback_message": "", "custom_instructions": "", "token_balance": 0, "tokens_used": 0,
		})
		return
	}

	c.JSON(http.StatusOK, config)
}

func (h *AIBotHandler) SaveConfig(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var req struct {
		BrandName          string `json:"brand_name"`
		BrandDescription   string `json:"brand_description"`
		BrandTone          string `json:"brand_tone"`
		ProductsServices   string `json:"products_services"`
		FAQ                string `json:"faq"`
		Policies           string `json:"policies"`
		GreetingMessage    string `json:"greeting_message"`
		FallbackMessage    string `json:"fallback_message"`
		CustomInstructions string `json:"custom_instructions"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := h.db.Pool.Exec(ctx,
		`INSERT INTO ai_bot_config (org_id, brand_name, brand_description, brand_tone, products_services, faq, policies, greeting_message, fallback_message, custom_instructions, token_balance)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1000)
		 ON CONFLICT (org_id) DO UPDATE SET
		   brand_name = $2, brand_description = $3, brand_tone = $4, products_services = $5,
		   faq = $6, policies = $7, greeting_message = $8, fallback_message = $9,
		   custom_instructions = $10, updated_at = NOW()`,
		orgID, req.BrandName, req.BrandDescription, req.BrandTone, req.ProductsServices,
		req.FAQ, req.Policies, req.GreetingMessage, req.FallbackMessage, req.CustomInstructions)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Config saved"})
}

func (h *AIBotHandler) Toggle(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var isEnabled bool
	err := h.db.Pool.QueryRow(ctx,
		`UPDATE ai_bot_config SET is_enabled = NOT is_enabled, updated_at = NOW()
		 WHERE org_id = $1 RETURNING is_enabled`, orgID,
	).Scan(&isEnabled)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "AI Bot henuz yapilandirilmadi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_enabled": isEnabled})
}

func (h *AIBotHandler) GetUsage(c *gin.Context) {
	orgID := c.GetInt64("org_id")
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var tokenBalance, tokensUsed, totalResponses int
	h.db.Pool.QueryRow(ctx,
		`SELECT COALESCE(token_balance, 0), COALESCE(tokens_used, 0)
		 FROM ai_bot_config WHERE org_id = $1`, orgID,
	).Scan(&tokenBalance, &tokensUsed)

	h.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM ai_bot_logs WHERE org_id = $1`, orgID,
	).Scan(&totalResponses)

	// Recent logs
	rows, err := h.db.Pool.Query(ctx,
		`SELECT conversation_id, LEFT(customer_message, 80), LEFT(ai_response, 120), tokens_used, created_at
		 FROM ai_bot_logs WHERE org_id = $1
		 ORDER BY created_at DESC LIMIT 20`, orgID)

	type logEntry struct {
		ConversationID int64  `json:"conversation_id"`
		CustomerMsg    string `json:"customer_message"`
		AIResponse     string `json:"ai_response"`
		TokensUsed     int    `json:"tokens_used"`
		CreatedAt      string `json:"created_at"`
	}

	var logs []logEntry
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var l logEntry
			var convID *int64
			var createdAt time.Time
			if rows.Scan(&convID, &l.CustomerMsg, &l.AIResponse, &l.TokensUsed, &createdAt) == nil {
				if convID != nil {
					l.ConversationID = *convID
				}
				l.CreatedAt = createdAt.Format(time.RFC3339)
				logs = append(logs, l)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"token_balance":   tokenBalance,
		"tokens_used":     tokensUsed,
		"total_responses": totalResponses,
		"logs":            logs,
	})
}
