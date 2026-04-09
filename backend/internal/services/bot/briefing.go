package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/repliq/backend/internal/database"
)

type BriefingService struct {
	db     *database.DB
	apiKey string
}

func NewBriefingService(db *database.DB, apiKey string) *BriefingService {
	return &BriefingService{db: db, apiKey: apiKey}
}

type BriefingData struct {
	UnansweredConversations []UnansweredConv  `json:"unanswered_conversations"`
	StaleCustomers          []StaleCustomer   `json:"stale_customers"`
	AgentPerformance        []AgentPerf       `json:"agent_performance"`
	PendingActions          []PendingAction   `json:"pending_actions"`
	AIBriefing              string            `json:"ai_briefing"`
}

type UnansweredConv struct {
	ConversationID int64     `json:"conversation_id"`
	ContactName    string    `json:"contact_name"`
	ChannelType    string    `json:"channel_type"`
	LastMessage    string    `json:"last_message"`
	LastMessageAt  time.Time `json:"last_message_at"`
	HoursWaiting   int       `json:"hours_waiting"`
	AssignedTo     string    `json:"assigned_to"`
}

type StaleCustomer struct {
	CustomerID    int64  `json:"customer_id"`
	Name          string `json:"name"`
	Company       string `json:"company"`
	PipelineStage string `json:"pipeline_stage"`
	DaysInStage   int    `json:"days_in_stage"`
	AssignedTo    string `json:"assigned_to"`
}

type AgentPerf struct {
	Name              string `json:"name"`
	OpenConversations int    `json:"open_conversations"`
	AvgResponseHours  int    `json:"avg_response_hours"`
	ActivitiesToday   int    `json:"activities_today"`
	ActivitiesWeek    int    `json:"activities_week"`
}

type PendingAction struct {
	CustomerID   int64  `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	Action       string `json:"action"`
	Detail       string `json:"detail"`
	DaysAgo      int    `json:"days_ago"`
}

func (b *BriefingService) GenerateBriefing(ctx context.Context, orgID int64) (*BriefingData, error) {
	data := &BriefingData{}

	// 1. Unanswered conversations - customer sent last message, no agent reply
	rows, err := b.db.Pool.Query(ctx,
		`SELECT cv.id, COALESCE(co.name, 'Bilinmeyen'), COALESCE(ch.type, ''),
		        COALESCE(m.content, ''), m.created_at,
		        EXTRACT(EPOCH FROM (NOW() - m.created_at))/3600 as hours,
		        COALESCE(u.full_name, 'Atanmamis')
		 FROM conversations cv
		 JOIN LATERAL (
		   SELECT content, sender_type, created_at FROM messages
		   WHERE conversation_id = cv.id AND is_internal = false
		   ORDER BY created_at DESC LIMIT 1
		 ) m ON true
		 LEFT JOIN contacts co ON cv.contact_id = co.id
		 LEFT JOIN channels ch ON cv.channel_id = ch.id
		 LEFT JOIN users u ON cv.assigned_to = u.id
		 WHERE cv.org_id = $1
		   AND cv.status IN ('open', 'pending')
		   AND m.sender_type = 'contact'
		   AND m.created_at > NOW() - INTERVAL '7 days'
		 ORDER BY m.created_at ASC
		 LIMIT 50`, orgID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c UnansweredConv
			var hours float64
			if err := rows.Scan(&c.ConversationID, &c.ContactName, &c.ChannelType,
				&c.LastMessage, &c.LastMessageAt, &hours, &c.AssignedTo); err != nil {
				continue
			}
			c.HoursWaiting = int(hours)
			if len(c.LastMessage) > 100 {
				c.LastMessage = c.LastMessage[:100] + "..."
			}
			data.UnansweredConversations = append(data.UnansweredConversations, c)
		}
	}

	// 2. Stale customers - stuck in pipeline stage > 5 days
	rows2, err := b.db.Pool.Query(ctx,
		`SELECT c.id, c.name, COALESCE(c.company,''), COALESCE(c.pipeline_stage,'new_contact'),
		        EXTRACT(DAY FROM (NOW() - COALESCE(c.pipeline_updated_at, c.created_at))) as days,
		        COALESCE(u.full_name, 'Atanmamis')
		 FROM customers c
		 LEFT JOIN users u ON c.assigned_to = u.id
		 WHERE c.org_id = $1
		   AND COALESCE(c.pipeline_stage,'new_contact') NOT IN ('shipping')
		   AND COALESCE(c.pipeline_updated_at, c.created_at) < NOW() - INTERVAL '5 days'
		 ORDER BY c.pipeline_updated_at ASC NULLS FIRST
		 LIMIT 30`, orgID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var s StaleCustomer
			var days float64
			if err := rows2.Scan(&s.CustomerID, &s.Name, &s.Company, &s.PipelineStage, &days, &s.AssignedTo); err != nil {
				continue
			}
			s.DaysInStage = int(days)
			data.StaleCustomers = append(data.StaleCustomers, s)
		}
	}

	// 3. Agent performance
	rows3, err := b.db.Pool.Query(ctx,
		`SELECT u.full_name,
		        COALESCE((SELECT COUNT(*) FROM conversations WHERE assigned_to = u.id AND org_id = $1 AND status IN ('open','pending')), 0) as open_convs,
		        COALESCE((SELECT COUNT(*) FROM customer_activities WHERE created_by = u.id AND org_id = $1 AND created_at >= CURRENT_DATE), 0) as today_acts,
		        COALESCE((SELECT COUNT(*) FROM customer_activities WHERE created_by = u.id AND org_id = $1 AND created_at >= NOW() - INTERVAL '7 days'), 0) as week_acts
		 FROM users u
		 JOIN org_members om ON u.id = om.user_id
		 WHERE om.org_id = $1
		 ORDER BY u.full_name`, orgID)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var a AgentPerf
			if err := rows3.Scan(&a.Name, &a.OpenConversations, &a.ActivitiesToday, &a.ActivitiesWeek); err != nil {
				continue
			}
			data.AgentPerformance = append(data.AgentPerformance, a)
		}
	}

	// 4. Pending actions - customers who received catalog but no kartela/sample follow-up
	rows4, err := b.db.Pool.Query(ctx,
		`SELECT c.id, c.name,
		        COALESCE(c.pipeline_stage,'new_contact'),
		        EXTRACT(DAY FROM (NOW() - COALESCE(c.pipeline_updated_at, c.created_at))) as days
		 FROM customers c
		 WHERE c.org_id = $1
		   AND c.pipeline_stage IN ('catalog_sent', 'kartela_sent')
		   AND COALESCE(c.pipeline_updated_at, c.created_at) < NOW() - INTERVAL '3 days'
		 ORDER BY c.pipeline_updated_at ASC NULLS FIRST
		 LIMIT 20`, orgID)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var p PendingAction
			var stage string
			var days float64
			if err := rows4.Scan(&p.CustomerID, &p.CustomerName, &stage, &days); err != nil {
				continue
			}
			p.DaysAgo = int(days)
			if stage == "catalog_sent" {
				p.Action = "Kartela/Numune bekleniyor"
				p.Detail = "Katalog gonderildi ama takip yapilmadi"
			} else {
				p.Action = "Numune bekleniyor"
				p.Detail = "Kartela gonderildi ama numune gonderilmedi"
			}
			data.PendingActions = append(data.PendingActions, p)
		}
	}

	// 5. AI Briefing - generate summary with Claude
	if b.apiKey != "" {
		briefingPrompt := b.buildBriefingPrompt(data)
		aiSummary, err := b.callClaudeForBriefing(ctx, briefingPrompt)
		if err == nil {
			data.AIBriefing = aiSummary
		}
	}

	return data, nil
}

func (b *BriefingService) buildBriefingPrompt(data *BriefingData) string {
	prompt := "Asagidaki verilere dayanarak Messe Tekstil B2B CRM icin kisa bir sabah brifing raporu hazirla. Turkce yaz, madde madde, onemli konulari one cikar.\n\n"

	if len(data.UnansweredConversations) > 0 {
		prompt += fmt.Sprintf("CEVAPLANMAMIS KONUSMALAR (%d adet):\n", len(data.UnansweredConversations))
		for _, c := range data.UnansweredConversations {
			prompt += fmt.Sprintf("- %s (%s): %dsa bekliyor, atanan: %s, mesaj: \"%s\"\n",
				c.ContactName, c.ChannelType, c.HoursWaiting, c.AssignedTo, c.LastMessage)
		}
	}

	if len(data.StaleCustomers) > 0 {
		prompt += fmt.Sprintf("\nTAKIPSIZ MUSTERILER (%d adet, 5+ gun ayni asamada):\n", len(data.StaleCustomers))
		for _, s := range data.StaleCustomers {
			prompt += fmt.Sprintf("- %s (%s): %s asamasinda %d gundur, atanan: %s\n",
				s.Name, s.Company, s.PipelineStage, s.DaysInStage, s.AssignedTo)
		}
	}

	if len(data.PendingActions) > 0 {
		prompt += fmt.Sprintf("\nBEKLEYEN AKSIYONLAR (%d adet):\n", len(data.PendingActions))
		for _, p := range data.PendingActions {
			prompt += fmt.Sprintf("- %s: %s (%d gun once)\n", p.CustomerName, p.Action, p.DaysAgo)
		}
	}

	if len(data.AgentPerformance) > 0 {
		prompt += "\nPERSONEL DURUMU:\n"
		for _, a := range data.AgentPerformance {
			prompt += fmt.Sprintf("- %s: %d acik konusma, bugun %d / hafta %d aksiyon\n",
				a.Name, a.OpenConversations, a.ActivitiesToday, a.ActivitiesWeek)
		}
	}

	prompt += "\nKisa ve net bir brifing yaz. En acil konulari belirt. Oneriler sun."
	return prompt
}

func (b *BriefingService) callClaudeForBriefing(ctx context.Context, prompt string) (string, error) {
	type msg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	reqBody := map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 500,
		"system":     "Sen Messe Tekstil'in B2B CRM asistanisin. Her sabah patrona kisa brifing raporu hazirliyorsun. Turkce yaz, profesyonel ve net ol. Emoji kullanma.",
		"messages":   []msg{{Role: "user", Content: prompt}},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", b.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response")
	}
	return result.Content[0].Text, nil
}
