// Package translate provides per-message translation for tenants that need it.
//
// Currently scoped to org_id == EstedisOrgID (Bulgaria dental clinic, Bulgarian
// inbox traffic translated to Turkish so the owner can read it). The Service is
// safe to call for any org — it no-ops outside the allowed list, and no-ops if
// no API key was configured at startup.
package translate

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

// EstedisOrgID is the only tenant that currently gets translations.
const EstedisOrgID = 5

const (
	claudeModel = "claude-haiku-4-5-20251001"
	claudeURL   = "https://api.anthropic.com/v1/messages"
)

type Service struct {
	db     *database.DB
	apiKey string
	client *http.Client
}

func NewService(db *database.DB, apiKey string) *Service {
	return &Service{
		db:     db,
		apiKey: apiKey,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

// Apply runs in a goroutine after a message is inserted. It silently no-ops
// for any org other than Estedis, for empty content, or when no API key was
// configured.
func (s *Service) Apply(orgID, messageID int64, content string) {
	if s == nil || s.apiKey == "" {
		return
	}
	if orgID != EstedisOrgID {
		return
	}
	if content == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	tr, lang, err := s.translate(ctx, content)
	if err != nil {
		log.Printf("[TRANSLATE] org=%d msg=%d error: %v", orgID, messageID, err)
		return
	}
	if tr == "" {
		return // already in TR or detected no-op
	}

	_, err = s.db.Pool.Exec(ctx,
		`UPDATE messages SET translation = $1, translation_lang = $2 WHERE id = $3`,
		tr, lang, messageID,
	)
	if err != nil {
		log.Printf("[TRANSLATE] org=%d msg=%d save error: %v", orgID, messageID, err)
	}
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type translatePayload struct {
	SourceLang  string `json:"source_lang"`
	Translation string `json:"translation"`
	Skip        bool   `json:"skip"`
}

const systemPrompt = `You are a translation engine. Detect the source language of the user's message and translate it into Turkish (tr).

Rules:
- If the source is already Turkish, return: {"skip": true}
- Otherwise return: {"source_lang": "<bcp47-or-iso639-1 code>", "translation": "<Turkish text>"}
- "translation" must preserve meaning, tone, names, numbers, emojis, and URLs as-is.
- Output ONLY the JSON object. No prose, no markdown, no code fences.`

func (s *Service) translate(ctx context.Context, content string) (string, string, error) {
	reqBody := claudeRequest{
		Model:     claudeModel,
		MaxTokens: 600,
		System:    systemPrompt,
		Messages:  []claudeMessage{{Role: "user", Content: content}},
	}
	buf, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", claudeURL, bytes.NewReader(buf))
	if err != nil {
		return "", "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("call: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("read: %w", err)
	}
	if resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("status=%d body=%s", resp.StatusCode, string(body))
	}

	var cresp claudeResponse
	if err := json.Unmarshal(body, &cresp); err != nil {
		return "", "", fmt.Errorf("parse claude response: %w (body=%s)", err, string(body))
	}
	if cresp.Error != nil {
		return "", "", fmt.Errorf("claude error: %s", cresp.Error.Message)
	}
	if len(cresp.Content) == 0 || cresp.Content[0].Text == "" {
		return "", "", fmt.Errorf("empty claude content")
	}

	raw := cresp.Content[0].Text
	var payload translatePayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return "", "", fmt.Errorf("parse translation json: %w (raw=%s)", err, raw)
	}
	if payload.Skip {
		return "", "", nil
	}
	return payload.Translation, payload.SourceLang, nil
}
