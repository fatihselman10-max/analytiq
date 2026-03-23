package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
)

type AIBot struct {
	db     *database.DB
	apiKey string
}

func NewAIBot(db *database.DB, apiKey string) *AIBot {
	return &AIBot{db: db, apiKey: apiKey}
}

type AIBotConfig struct {
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

type claudeRequest struct {
	Model     string           `json:"model"`
	MaxTokens int              `json:"max_tokens"`
	System    string           `json:"system"`
	Messages  []claudeMessage  `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// ProcessMessage generates an AI response for a customer message.
// Returns the response text, whether it responded, and any error.
func (ai *AIBot) ProcessMessage(ctx context.Context, orgID int64, conversationID int64, customerMessage string, channelType string) (string, bool, error) {
	if ai.apiKey == "" {
		return "", false, nil
	}

	// Load AI bot config
	config, err := ai.getConfig(ctx, orgID)
	if err != nil || config == nil || !config.IsEnabled {
		return "", false, nil
	}

	// Check token balance
	if config.TokenBalance <= 0 {
		log.Printf("[AI Bot] Org %d has no token balance remaining", orgID)
		if config.FallbackMessage != "" {
			ai.insertBotMessage(ctx, conversationID, config.FallbackMessage)
			return config.FallbackMessage, true, nil
		}
		return "", false, nil
	}

	// Get conversation history (last 10 messages for context)
	history := ai.getConversationHistory(ctx, conversationID)

	// Build system prompt from brand config
	systemPrompt := ai.buildSystemPrompt(config)

	// Build messages array
	var messages []claudeMessage
	for _, h := range history {
		messages = append(messages, claudeMessage{Role: h.Role, Content: h.Content})
	}
	messages = append(messages, claudeMessage{Role: "user", Content: customerMessage})

	// Call Claude API
	response, tokensUsed, err := ai.callClaude(ctx, systemPrompt, messages)
	if err != nil {
		log.Printf("[AI Bot] Claude API error for org %d: %v", orgID, err)
		return "", false, err
	}

	// Save response as bot message
	ai.insertBotMessage(ctx, conversationID, response)

	// Log the AI interaction
	ai.db.Pool.Exec(ctx,
		`INSERT INTO ai_bot_logs (org_id, conversation_id, customer_message, ai_response, tokens_used, model)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		orgID, conversationID, customerMessage, response, tokensUsed, "claude-haiku-4-5-20251001")

	// Deduct tokens
	ai.db.Pool.Exec(ctx,
		`UPDATE ai_bot_config SET tokens_used = tokens_used + $1, token_balance = token_balance - $1, updated_at = NOW()
		 WHERE org_id = $2`,
		tokensUsed, orgID)

	log.Printf("[AI Bot] Responded to org %d conv %d, tokens: %d", orgID, conversationID, tokensUsed)
	return response, true, nil
}

func (ai *AIBot) getConfig(ctx context.Context, orgID int64) (*AIBotConfig, error) {
	var c AIBotConfig
	err := ai.db.Pool.QueryRow(ctx,
		`SELECT id, org_id, is_enabled, COALESCE(brand_name,''), COALESCE(brand_description,''),
		        COALESCE(brand_tone,'professional'), COALESCE(products_services,''), COALESCE(faq,''),
		        COALESCE(policies,''), COALESCE(greeting_message,''), COALESCE(fallback_message,''),
		        COALESCE(custom_instructions,''), token_balance, tokens_used
		 FROM ai_bot_config WHERE org_id = $1`, orgID,
	).Scan(&c.ID, &c.OrgID, &c.IsEnabled, &c.BrandName, &c.BrandDescription,
		&c.BrandTone, &c.ProductsServices, &c.FAQ, &c.Policies,
		&c.GreetingMessage, &c.FallbackMessage, &c.CustomInstructions,
		&c.TokenBalance, &c.TokensUsed)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (ai *AIBot) buildSystemPrompt(config *AIBotConfig) string {
	prompt := fmt.Sprintf(`Sen "%s" markasının müşteri destek asistanısın. Müşterilere yardımcı, nazik ve profesyonel bir şekilde yanıt veriyorsun.

MARKA BİLGİLERİ:
%s

`, config.BrandName, config.BrandDescription)

	if config.ProductsServices != "" {
		prompt += fmt.Sprintf("ÜRÜN VE HİZMETLER:\n%s\n\n", config.ProductsServices)
	}

	if config.FAQ != "" {
		prompt += fmt.Sprintf("SIK SORULAN SORULAR:\n%s\n\n", config.FAQ)
	}

	if config.Policies != "" {
		prompt += fmt.Sprintf("POLİTİKALAR (İade, Kargo, vb.):\n%s\n\n", config.Policies)
	}

	toneMap := map[string]string{
		"professional": "Profesyonel ve resmi bir dil kullan.",
		"friendly":     "Samimi ve sıcak bir dil kullan, emoji kullanabilirsin.",
		"casual":       "Günlük ve rahat bir dil kullan.",
		"formal":       "Çok resmi ve kurumsal bir dil kullan.",
	}
	if tone, ok := toneMap[config.BrandTone]; ok {
		prompt += "ÜSLUP: " + tone + "\n\n"
	}

	if config.CustomInstructions != "" {
		prompt += fmt.Sprintf("EK TALİMATLAR:\n%s\n\n", config.CustomInstructions)
	}

	prompt += `KURALLAR:
- Kısa ve öz cevaplar ver, müşteriyi sıkmadan.
- Bilmediğin bir konu sorulursa "Bu konuda size yardımcı olabilecek bir temsilcimize bağlanmanızı öneriyorum" de.
- Asla uydurma bilgi verme.
- Müşterinin dilinde (Türkçe/İngilizce) yanıt ver.
- Fiyat veya stok bilgisi sorulduğunda, eğer bilgin yoksa yönlendirme yap.`

	return prompt
}

type historyMessage struct {
	Role    string
	Content string
}

func (ai *AIBot) getConversationHistory(ctx context.Context, conversationID int64) []historyMessage {
	rows, err := ai.db.Pool.Query(ctx,
		`SELECT sender_type, content FROM messages
		 WHERE conversation_id = $1 AND is_internal = false AND content_type = 'text'
		 ORDER BY created_at DESC LIMIT 10`, conversationID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var msgs []historyMessage
	for rows.Next() {
		var senderType, content string
		if rows.Scan(&senderType, &content) == nil {
			role := "user"
			if senderType == "agent" || senderType == "bot" {
				role = "assistant"
			}
			msgs = append(msgs, historyMessage{Role: role, Content: content})
		}
	}

	// Reverse to chronological order
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}

	return msgs
}

func (ai *AIBot) callClaude(ctx context.Context, systemPrompt string, messages []claudeMessage) (string, int, error) {
	reqBody := claudeRequest{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 300,
		System:    systemPrompt,
		Messages:  messages,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return "", 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", ai.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return "", 0, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var claudeResp claudeResponse
	if err := json.Unmarshal(body, &claudeResp); err != nil {
		return "", 0, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return "", 0, fmt.Errorf("empty response from Claude")
	}

	totalTokens := claudeResp.Usage.InputTokens + claudeResp.Usage.OutputTokens
	return claudeResp.Content[0].Text, totalTokens, nil
}

func (ai *AIBot) insertBotMessage(ctx context.Context, conversationID int64, content string) {
	ai.db.Pool.Exec(ctx,
		`INSERT INTO messages (conversation_id, sender_type, content, content_type)
		 VALUES ($1, 'bot', $2, 'text')`, conversationID, content)

	now := time.Now()
	ai.db.Pool.Exec(ctx,
		`UPDATE conversations SET last_message_at = $1, updated_at = $1 WHERE id = $2`,
		now, conversationID)
}
