package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
)

type AIBot struct {
	db      *database.DB
	apiKey  string
	oplog   *OplogClient
	shopify *ShopifyClient
}

func NewAIBot(db *database.DB, apiKey string) *AIBot {
	return &AIBot{db: db, apiKey: apiKey, oplog: NewOplogClient(), shopify: NewShopifyClient()}
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

	// Check for order numbers and fetch from both Shopify and Oplog
	orderNums := ExtractOrderNumbers(customerMessage)
	if len(orderNums) > 0 {
		log.Printf("[AI Bot] Detected order numbers in message: %v", orderNums)
	}
	for _, num := range orderNums {
		var oplogOrder *OplogOrder
		var shopifyOrder *ShopifyOrder

		// Fetch from Shopify
		if ai.shopify.IsConfigured() {
			so, err := ai.shopify.LookupOrderByNumber(ctx, num)
			if err != nil {
				log.Printf("[AI Bot] Shopify lookup error for #%s: %v", num, err)
			} else if so != nil {
				log.Printf("[AI Bot] Shopify found order #%s → financial: %s, fulfillment: %s", num, so.FinancialStatus, so.FulfillmentStatus)
				shopifyOrder = so
			}
		}

		// Fetch from Oplog
		if ai.oplog.IsConfigured() {
			oo, err := ai.oplog.LookupOrder(ctx, num)
			if err != nil {
				log.Printf("[AI Bot] Oplog lookup error for #%s: %v", num, err)
			} else if oo != nil {
				log.Printf("[AI Bot] Oplog found order #%s → state: %s", num, oo.State)
				oplogOrder = oo
			}
		}

		// Combine both sources
		combined := CombineOrderContext(oplogOrder, shopifyOrder)
		if combined != "" {
			systemPrompt += "\n\n" + combined
		} else {
			log.Printf("[AI Bot] Order #%s not found in any system", num)
			systemPrompt += fmt.Sprintf("\n\nSİPARİŞ #%s: Bu sipariş henüz sistemde bulunamadı. Müşteriye siparişinin ekibimiz tarafından kontrol edilip en kısa sürede dönüş yapılacağını bildir.", num)
		}
	}

	// Check for product-related questions and fetch from Shopify
	if ai.shopify.IsConfigured() && len(orderNums) == 0 {
		productQuery := ExtractProductQuery(customerMessage)
		if productQuery != "" {
			products, err := ai.shopify.SearchProducts(ctx, productQuery)
			if err != nil {
				log.Printf("[AI Bot] Shopify product search error: %v", err)
			} else if len(products) > 0 {
				log.Printf("[AI Bot] Shopify found %d products for query '%s'", len(products), productQuery)
				systemPrompt += "\n\n" + FormatShopifyProductContext(products)
			}
		} else {
			// Generic preorder info for product questions
			msg := strings.ToLower(customerMessage)
			preorderKeywords := []string{"pre-order", "preorder", "ön sipariş", "ne zaman gelir", "kaç gün", "kac gun", "teslimat süresi", "teslimat suresi"}
			for _, kw := range preorderKeywords {
				if strings.Contains(msg, kw) {
					systemPrompt += "\n\nPRE-ORDER BİLGİSİ: LessandRomance ürünlerinin çoğu pre-order (ön sipariş) sistemiyle satılır. Teslimat süresi sipariş tarihinden itibaren 14-21 iş günüdür. Ürünler özel olarak hazırlanıp kargoya verilir."
					break
				}
			}
		}
	}

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
	prompt := fmt.Sprintf(`Sen %s müşteri destek temsilcisisin. Sadece 1-2 cümle yaz, kesinlikle daha fazla değil. Aşağıdaki örnekler gibi kısa ve düz yaz:

Müşteri: "siparişim nerede" → Sen: "Sipariş numaranızı paylaşır mısınız?"
Müşteri: "merhaba" → Sen: "Merhaba, nasıl yardımcı olabilirim?"
Müşteri: "iade istiyorum" → Sen: "info@lessandromance.com adresine sipariş numaranızı yazın, ekip süreci başlatacak."

Bu örneklerdeki kısalığı ve tonu koru. Daha uzun veya duygusal yazma.

Marka: %s

`, config.BrandName, config.BrandDescription)

	if config.ProductsServices != "" {
		prompt += fmt.Sprintf("Ürünler:\n%s\n\n", config.ProductsServices)
	}

	if config.FAQ != "" {
		prompt += fmt.Sprintf("SSS:\n%s\n\n", config.FAQ)
	}

	if config.Policies != "" {
		prompt += fmt.Sprintf("Politikalar:\n%s\n\n", config.Policies)
	}

	if config.CustomInstructions != "" {
		prompt += config.CustomInstructions + "\n\n"
	}

	prompt += `KURALLAR:
1. Maksimum 2 cümle. Cümlelerini tam bitir.
2. Düz metin. Formatlama yok, emoji yok, liste yok.
3. YASAK kelimeler: haklısınız, üzgünüm, hayal kırıcı, endişelenmeyin, kesinlikle, mutlaka, tabii ki, hoş geldiniz, normal değil.
4. Yorum yapma, değerlendirme yapma. Sadece bilgi ver veya yönlendir.
5. Sipariş numarası yoksa sadece numara iste.
6. Sipariş bilgisi varsa durumu ve kargo bilgisini yaz.
7. Sipariş bulunamadıysa: "Ekibimize ilettim, kontrol edip dönüş yapacaklar."
8. Pre-order ürünler için teslimat süresi 14-21 iş günüdür. Stok sorulursa "ön sipariş ile satılıyor" de.
9. Shopify ve Oplog verisi birlikte verilirse ikisini analiz et: Shopify sipariş detayı, Oplog kargo/depo durumu.

ÖRNEKLER:
"siparisim nerede" + bilgi var → "Siparişiniz 20 Mart'ta kargoya verildi. Takip no: 903421767."
"kargom gelmedi" + no yok → "Sipariş numaranızı paylaşır mısınız?"
"20 gun oldu gelmedi" → "Sipariş numaranızı paylaşır mısınız, durumunu kontrol edeyim."
"iade istiyorum" → "14 gün içinde iade yapılabilir. info@lessandromance.com adresine sipariş numaranızı yazın."
"merhaba" → "Merhaba, nasıl yardımcı olabilirim?"
"isbirligi" → "info@lessandromance.com adresine yazabilirsiniz."
bulunamayan sipariş → "Ekibimize ilettim, kontrol edip dönüş yapacaklar."
"stokta var mı" → "Bu ürün ön sipariş ile satılıyor. Sipariş verdikten sonra 14-21 iş günü içinde teslim edilir."
"ne zaman gelir" + preorder → "Pre-order ürünler sipariş tarihinden itibaren 14-21 iş günü içinde kargoya verilir."`

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
		MaxTokens: 120,
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
	text := trimToLastSentence(claudeResp.Content[0].Text)
	return text, totalTokens, nil
}

// trimToLastSentence cuts off any incomplete sentence at the end.
func trimToLastSentence(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	// If already ends with sentence-ending punctuation, return as-is
	last := s[len(s)-1]
	if last == '.' || last == '?' || last == '!' {
		return s
	}
	// Find the last sentence-ending punctuation
	lastDot := strings.LastIndexAny(s, ".?!")
	if lastDot > 0 {
		return strings.TrimSpace(s[:lastDot+1])
	}
	// No sentence ending found, return as-is
	return s
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
