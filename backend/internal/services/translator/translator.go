package translator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"
)

type Translator struct {
	apiKey string
	client *http.Client
}

func New(apiKey string) *Translator {
	return &Translator{
		apiKey: apiKey,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// NeedsTranslation reports whether the text contains non-Latin-or-Turkish
// characters that Burcu (Turkish speaker) cannot read directly. Currently
// detects Cyrillic / Greek / Arabic / Han.
func NeedsTranslation(text string) bool {
	if strings.TrimSpace(text) == "" {
		return false
	}
	for _, r := range text {
		if unicode.Is(unicode.Cyrillic, r) ||
			unicode.Is(unicode.Greek, r) ||
			unicode.Is(unicode.Arabic, r) ||
			unicode.Is(unicode.Han, r) ||
			unicode.Is(unicode.Hangul, r) ||
			unicode.Is(unicode.Hebrew, r) {
			return true
		}
	}
	return false
}

// TranslateBatch takes a slice of texts and returns Turkish translations in
// the same order. Empty or already-Turkish entries are returned as empty
// strings so the caller can skip them. One Claude Haiku call per batch.
func (t *Translator) TranslateBatch(ctx context.Context, texts []string) ([]string, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("translator: missing api key")
	}

	out := make([]string, len(texts))
	type indexedText struct {
		idx  int
		text string
	}
	toTranslate := []indexedText{}
	for i, txt := range texts {
		trimmed := strings.TrimSpace(txt)
		if trimmed == "" || !NeedsTranslation(trimmed) {
			continue
		}
		toTranslate = append(toTranslate, indexedText{i, trimmed})
	}
	if len(toTranslate) == 0 {
		return out, nil
	}

	payload := make([]map[string]string, len(toTranslate))
	for i, it := range toTranslate {
		payload[i] = map[string]string{"id": fmt.Sprintf("%d", i), "text": it.text}
	}
	payloadJSON, _ := json.Marshal(payload)

	prompt := fmt.Sprintf(`Aşağıdaki mesajları Türkçe'ye çevir.

Kurallar:
- Sadece çeviriyi döndür, açıklama yok
- Kısa ve doğal Türkçe kullan
- Selamlaşmaları koru
- Tekstil iş terimlerini (fabric, sample, catalog) Türkçe karşılıklarıyla çevir (kumaş, numune, katalog)

Giriş: JSON array [{"id":"0","text":"..."}]

Çıkış: SADECE JSON array [{"id":"0","tr":"..."}] — başka metin yok.

Girdi:
%s`, string(payloadJSON))

	type msg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	reqBody := map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 4000,
		"system":     "Sen bir çeviri motorusun. Sadece geçerli JSON döndür.",
		"messages":   []msg{{Role: "user", Content: prompt}},
	}
	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", t.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("translator: api %d: %s", resp.StatusCode, string(body))
	}

	var apiResp struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, err
	}
	if len(apiResp.Content) == 0 {
		return nil, fmt.Errorf("translator: empty response")
	}

	raw := strings.TrimSpace(apiResp.Content[0].Text)
	// Strip potential code fences
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var results []struct {
		ID string `json:"id"`
		TR string `json:"tr"`
	}
	if err := json.Unmarshal([]byte(raw), &results); err != nil {
		return nil, fmt.Errorf("translator: unmarshal: %w; raw=%s", err, raw)
	}

	for _, r := range results {
		var idx int
		if _, err := fmt.Sscanf(r.ID, "%d", &idx); err != nil {
			continue
		}
		if idx < 0 || idx >= len(toTranslate) {
			continue
		}
		origIdx := toTranslate[idx].idx
		out[origIdx] = r.TR
	}

	return out, nil
}
