package activity

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Detection struct {
	ActivityType string `json:"activity_type"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	Confidence   int    `json:"confidence"`
	DetectedBy   string `json:"detected_by"`
	Metadata     string `json:"metadata"`
}

type Analyzer struct {
	apiKey string
	client *http.Client
}

func NewAnalyzer(apiKey string) *Analyzer {
	return &Analyzer{
		apiKey: apiKey,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

type ruleMatch struct {
	keywords []string
	regex    *regexp.Regexp
}

var (
	rxTracking = regexp.MustCompile(`\b([A-Z]{2,4}[- ]?\d{6,15}|\d{10,16})\b`)
	rxQuantity = regexp.MustCompile(`(?i)(\d{2,6})\s*(m|metre|метр|meter|meters|kg|kilogram)\b`)
)

var rules = map[string]ruleMatch{
	"sample_request": {keywords: []string{
		"numune", "sample", "образец", "образцы", "образцов",
	}},
	"kartela_request": {keywords: []string{
		"kartela", "color card", "swatch", "карта цветов", "цветовая карта", "палитра",
	}},
	"catalog_request": {keywords: []string{
		"katalog", "catalogue", "catalog", "каталог", "lookbook", "коллекция",
	}},
	"price_inquiry": {keywords: []string{
		"fiyat", "price", "cost", "стоимость", "цена", "сколько стоит", "по чем", "почем",
	}},
	"order_intent": {keywords: []string{
		"siparis", "sipariş", "order", "заказ", "заказать", "хочу взять", "купить", "alacağım", "almak istiyorum",
	}},
	"shipping_info": {keywords: []string{
		"kargo", "kargoya", "shipping", "tracking", "dhl", "ups", "fedex", "aramex", "доставка", "трек", "отправили",
	}},
	"meeting_request": {keywords: []string{
		"görüşme", "gorusme", "toplantı", "meeting", "встреча", "созвон", "call",
	}},
	"factory_visit": {keywords: []string{
		"fabrika", "showroom", "ziyaret", "visit", "офис посетить", "посетить",
	}},
	"sample_feedback": {keywords: []string{
		"beğendim", "begendim", "harika", "понравилось", "нравится", "отлично", "хорошо", "kötü", "плохо",
	}},
	"intro_video_sent": {keywords: []string{
		"tanıtım filmi", "tanitim filmi", "tanıtım videosu", "tanitim videosu", "промо видео", "презентация",
	}},
	"warehouse_video_sent": {keywords: []string{
		"depo videosu", "depo video", "warehouse video", "видео склада", "склад видео",
	}},
	"fair_invitation": {keywords: []string{
		"fuara davet", "fuar daveti", "moskova-minsk", "fair invitation", "приглашение на выставку", "пригласил на выставку",
	}},
	"bulk_message": {keywords: []string{
		"toplu mesaj", "toplu bilgilendirme", "toplu tanıtım", "bulk message", "рассылка",
	}},
	"initial_contact": {keywords: []string{
		"firma tanıtıldı", "firma tanitildi", "initial contact", "tanıtım mesajı gönderildi",
	}},
}

var titleByType = map[string]string{
	"sample_request":       "Numune talebi",
	"kartela_request":      "Kartela talebi",
	"catalog_request":      "Katalog talebi",
	"price_inquiry":        "Fiyat sorgusu",
	"order_intent":         "Sipariş niyeti",
	"shipping_info":        "Kargo bilgisi",
	"meeting_request":      "Görüşme talebi",
	"factory_visit":        "Ziyaret talebi",
	"sample_feedback":      "Numune geri bildirimi",
	"intro_video_sent":     "Tanıtım videosu gönderildi",
	"warehouse_video_sent": "Depo videosu gönderildi",
	"fair_invitation":      "Fuara davet",
	"bulk_message":         "Toplu mesaj / bilgilendirme",
	"initial_contact":      "İlk tanıtım",
	"note":                 "Not",
}

func (a *Analyzer) Analyze(ctx context.Context, text, channel string) []Detection {
	text = strings.TrimSpace(text)
	if text == "" || len(text) < 3 {
		return nil
	}
	lower := strings.ToLower(text)

	detections := []Detection{}
	matched := map[string]bool{}

	for actType, rule := range rules {
		for _, kw := range rule.keywords {
			if strings.Contains(lower, strings.ToLower(kw)) {
				if matched[actType] {
					continue
				}
				matched[actType] = true
				meta := map[string]interface{}{"keyword": kw, "channel": channel}
				if track := rxTracking.FindString(text); track != "" && actType == "shipping_info" {
					meta["tracking"] = track
				}
				if qty := rxQuantity.FindStringSubmatch(text); len(qty) > 0 && (actType == "order_intent" || actType == "sample_request") {
					meta["quantity"] = qty[0]
				}
				metaJSON, _ := json.Marshal(meta)
				detections = append(detections, Detection{
					ActivityType: actType,
					Title:        titleByType[actType],
					Description:  truncate(text, 280),
					Confidence:   85,
					DetectedBy:   "rule",
					Metadata:     string(metaJSON),
				})
				break
			}
		}
	}

	return detections
}

// AnalyzeWithAI runs Claude Haiku on the text when rules don't fire but text seems substantive
func (a *Analyzer) AnalyzeWithAI(ctx context.Context, text, channel string) []Detection {
	if a.apiKey == "" {
		return nil
	}
	text = strings.TrimSpace(text)
	if len(text) < 15 {
		return nil
	}

	prompt := fmt.Sprintf(`Sen bir B2B tekstil firmasının CRM asistanısın. Müşteri mesajlarını analiz edip iş aksiyonlarını yakalıyorsun.

Mesaj (%s kanalı):
"""
%s
"""

Bu mesajda aşağıdaki aksiyonlardan biri var mı? VAR ise SADECE JSON döndür, YOK ise {"actions":[]} döndür.

Geçerli activity_type değerleri:
- sample_request (numune talebi)
- kartela_request (kartela/renk kartı talebi)
- catalog_request (katalog talebi)
- price_inquiry (fiyat sorusu)
- order_intent (sipariş niyeti veya verme)
- shipping_info (kargo/takip bilgisi)
- meeting_request (görüşme/toplantı talebi)
- factory_visit (fabrika/showroom ziyaret talebi)
- sample_feedback (numuneden memnun/memnun değil)

Yanıt formatı (sadece JSON):
{"actions":[{"activity_type":"...","title":"kısa Türkçe başlık","description":"1 cümle","confidence":0-100}]}

Sadece açıkça anlaşılan aksiyonları yaz. Selamlama, sıradan mesajlar için boş döndür.`, channel, text)

	type msg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	reqBody := map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 400,
		"system":     "Sen bir CRM aksiyon tespit asistanısın. Sadece geçerli JSON döndür, başka açıklama yapma.",
		"messages":   []msg{{Role: "user", Content: prompt}},
	}
	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil
	}

	var apiResp struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil || len(apiResp.Content) == 0 {
		return nil
	}

	raw := apiResp.Content[0].Text
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return nil
	}
	raw = raw[start : end+1]

	var parsed struct {
		Actions []struct {
			ActivityType string `json:"activity_type"`
			Title        string `json:"title"`
			Description  string `json:"description"`
			Confidence   int    `json:"confidence"`
		} `json:"actions"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil
	}

	out := []Detection{}
	for _, a := range parsed.Actions {
		if a.ActivityType == "" || titleByType[a.ActivityType] == "" {
			continue
		}
		if a.Confidence < 50 {
			continue
		}
		title := a.Title
		if title == "" {
			title = titleByType[a.ActivityType]
		}
		meta, _ := json.Marshal(map[string]string{"channel": channel, "ai": "haiku"})
		out = append(out, Detection{
			ActivityType: a.ActivityType,
			Title:        title,
			Description:  truncate(a.Description, 280),
			Confidence:   a.Confidence,
			DetectedBy:   "ai",
			Metadata:     string(meta),
		})
	}
	return out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
