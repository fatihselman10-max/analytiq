package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/repliq/backend/internal/database"
)

// requiredAllowedUpdates is the canonical list of update types every Messe Tekstil
// Telegram bot must be subscribed to. Missing any of these silently breaks echo capture
// (e.g. removing business_message means agent's own outbound messages never reach the panel).
// Treat this list as a load-bearing invariant — adding/removing requires deliberate review.
var requiredAllowedUpdates = []string{
	"message",
	"edited_message",
	"channel_post",
	"business_connection",
	"business_message",
	"edited_business_message",
	"deleted_business_messages",
	"callback_query",
}

// SubscriptionStatus describes the live state of one telegram channel's webhook config.
type SubscriptionStatus struct {
	ChannelID         int64    `json:"channel_id"`
	ChannelName       string   `json:"channel_name"`
	OK                bool     `json:"ok"`
	URLMatches        bool     `json:"url_matches"`
	HasAllUpdates     bool     `json:"has_all_updates"`
	MissingUpdates    []string `json:"missing_updates,omitempty"`
	PendingCount      int      `json:"pending_update_count"`
	LastErrorMessage  string   `json:"last_error_message,omitempty"`
	WebhookURL        string   `json:"webhook_url,omitempty"`
	Reconfigured      bool     `json:"reconfigured"`
}

// EnsureSubscription scans every active Telegram channel and verifies its bot is
// subscribed to the full set of update types we depend on. Drift is auto-healed via
// setWebhook. Idempotent — safe to call on every boot and on a periodic timer.
//
// baseURL is the public origin of this backend (no trailing slash). When empty,
// channel.credentials.webhook_url is used; otherwise we build "<baseURL>/api/v1/webhooks/telegram".
func EnsureSubscription(ctx context.Context, db *database.DB, baseURL string) []SubscriptionStatus {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, COALESCE(name, ''), COALESCE(credentials::text, '{}')
		 FROM channels WHERE type = 'telegram' AND is_active = true`)
	if err != nil {
		log.Printf("[TG-SUB] query failed: %v", err)
		return nil
	}
	defer rows.Close()

	type chRow struct {
		id    int64
		name  string
		creds map[string]string
	}
	var rowsOut []chRow
	for rows.Next() {
		var r chRow
		var credsStr string
		if err := rows.Scan(&r.id, &r.name, &credsStr); err == nil {
			r.creds = map[string]string{}
			json.Unmarshal([]byte(credsStr), &r.creds)
			rowsOut = append(rowsOut, r)
		}
	}

	results := make([]SubscriptionStatus, 0, len(rowsOut))
	for _, r := range rowsOut {
		st := checkAndHeal(ctx, r.id, r.name, r.creds, baseURL)
		results = append(results, st)
	}
	return results
}

func checkAndHeal(ctx context.Context, channelID int64, channelName string, creds map[string]string, baseURL string) SubscriptionStatus {
	status := SubscriptionStatus{ChannelID: channelID, ChannelName: channelName}

	token := creds["bot_token"]
	if token == "" {
		token = creds["token"]
	}
	if token == "" {
		status.LastErrorMessage = "bot_token bulunamadı"
		return status
	}

	expectedURL := creds["webhook_url"]
	if expectedURL == "" && baseURL != "" {
		expectedURL = strings.TrimRight(baseURL, "/") + "/api/v1/webhooks/telegram"
	}
	status.WebhookURL = expectedURL

	info, err := getWebhookInfo(ctx, token)
	if err != nil {
		status.LastErrorMessage = "getWebhookInfo: " + err.Error()
		return status
	}
	status.PendingCount = info.PendingUpdateCount
	status.URLMatches = expectedURL == "" || info.URL == expectedURL
	status.MissingUpdates = diffMissing(requiredAllowedUpdates, info.AllowedUpdates)
	status.HasAllUpdates = len(status.MissingUpdates) == 0
	status.LastErrorMessage = info.LastErrorMessage

	needsReconfigure := !status.URLMatches || !status.HasAllUpdates
	if needsReconfigure && expectedURL != "" {
		if err := setWebhook(ctx, token, expectedURL, requiredAllowedUpdates); err != nil {
			status.LastErrorMessage = "setWebhook: " + err.Error()
			log.Printf("[TG-SUB] channel=%d setWebhook failed: %v", channelID, err)
			return status
		}
		status.Reconfigured = true
		status.URLMatches = true
		status.HasAllUpdates = true
		status.MissingUpdates = nil
		log.Printf("[TG-SUB] channel=%d reconfigured webhook (allowed_updates restored, pending=%d)", channelID, info.PendingUpdateCount)
	}

	status.OK = status.URLMatches && status.HasAllUpdates
	return status
}

func diffMissing(required, actual []string) []string {
	have := map[string]bool{}
	for _, u := range actual {
		have[u] = true
	}
	missing := []string{}
	for _, u := range required {
		if !have[u] {
			missing = append(missing, u)
		}
	}
	sort.Strings(missing)
	return missing
}

type webhookInfoResp struct {
	OK     bool `json:"ok"`
	Result struct {
		URL                string   `json:"url"`
		PendingUpdateCount int      `json:"pending_update_count"`
		LastErrorMessage   string   `json:"last_error_message"`
		AllowedUpdates     []string `json:"allowed_updates"`
	} `json:"result"`
	Description string `json:"description"`
}

func getWebhookInfo(ctx context.Context, token string) (*struct {
	URL                string
	PendingUpdateCount int
	LastErrorMessage   string
	AllowedUpdates     []string
}, error) {
	apiURL := "https://api.telegram.org/bot" + token + "/getWebhookInfo"
	req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	cl := &http.Client{Timeout: 10 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var parsed webhookInfoResp
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse: %w", err)
	}
	if !parsed.OK {
		return nil, fmt.Errorf("telegram api: %s", parsed.Description)
	}
	out := struct {
		URL                string
		PendingUpdateCount int
		LastErrorMessage   string
		AllowedUpdates     []string
	}{
		URL:                parsed.Result.URL,
		PendingUpdateCount: parsed.Result.PendingUpdateCount,
		LastErrorMessage:   parsed.Result.LastErrorMessage,
		AllowedUpdates:     parsed.Result.AllowedUpdates,
	}
	return &out, nil
}

func setWebhook(ctx context.Context, token, url string, allowedUpdates []string) error {
	body, _ := json.Marshal(map[string]interface{}{
		"url":                  url,
		"allowed_updates":      allowedUpdates,
		"drop_pending_updates": false,
	})
	apiURL := "https://api.telegram.org/bot" + token + "/setWebhook"
	req, _ := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	cl := &http.Client{Timeout: 10 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	var parsed struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	json.Unmarshal(respBody, &parsed)
	if !parsed.OK {
		return fmt.Errorf("setWebhook failed: %s", parsed.Description)
	}
	return nil
}

// Watch starts a goroutine that re-runs EnsureSubscription on `interval` (e.g. 6 hours).
// Returns immediately; the goroutine survives until ctx is cancelled. Logs every drift
// detection so prod issues are visible without dashboard access.
func Watch(ctx context.Context, db *database.DB, baseURL string, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				results := EnsureSubscription(ctx, db, baseURL)
				for _, st := range results {
					if !st.OK || st.Reconfigured {
						log.Printf("[TG-SUB] periodic check: channel=%d ok=%v reconfigured=%v missing=%v err=%q",
							st.ChannelID, st.OK, st.Reconfigured, st.MissingUpdates, st.LastErrorMessage)
					}
				}
			}
		}
	}()
}
