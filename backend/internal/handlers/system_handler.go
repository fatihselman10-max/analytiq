package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/channel/telegram"
)

// SystemHandler exposes a cached health snapshot for the Dashboard banner.
//
// Computing the snapshot is expensive: it (a) calls Telegram getWebhookInfo for every active
// Telegram channel and (b) pings the Anthropic API. To keep the panel responsive we cache the
// last result for 5 minutes and serve it from memory; the first request after a TTL miss pays
// the refresh cost (≈2-5s) but everyone else sees instant data.
//
// This intentionally does NOT wire up internal/services/system.Reconciler — Reconciler has
// heavy startup deps (activity service, IG poller, VK poller) and currently isn't scheduled
// anywhere. When that ever gets instantiated we can swap this handler to read Reconciler.Snapshot().
type SystemHandler struct {
	db *database.DB

	mu        sync.RWMutex
	snapshot  systemHealth
	cachedAt  time.Time
	refreshing bool
}

type systemHealth struct {
	LastReconcileAt          time.Time                      `json:"last_reconcile_at"`
	LastWarmupAt             *time.Time                     `json:"last_warmup_at,omitempty"`
	AnthropicOK              bool                           `json:"anthropic_ok"`
	AnthropicCheckedAt       time.Time                      `json:"anthropic_checked_at"`
	TelegramSubscriptionsOK  bool                           `json:"telegram_subscriptions_ok"`
	TelegramSubscriptions    []telegram.SubscriptionStatus `json:"telegram_subscriptions,omitempty"`
	Notes                    []string                       `json:"notes,omitempty"`
}

func NewSystemHandler(db *database.DB) *SystemHandler {
	return &SystemHandler{db: db}
}

const systemHealthCacheTTL = 5 * time.Minute

// Status returns the cached snapshot, refreshing it inline if older than TTL.
// First call after boot will be slow (~3-5s); subsequent calls within TTL are instant.
func (h *SystemHandler) Status(c *gin.Context) {
	h.mu.RLock()
	cached := h.snapshot
	cachedAt := h.cachedAt
	refreshing := h.refreshing
	h.mu.RUnlock()

	if !cachedAt.IsZero() && time.Since(cachedAt) < systemHealthCacheTTL {
		c.JSON(http.StatusOK, cached)
		return
	}

	// If another request is already refreshing AND we have ANY cached value, serve it stale.
	if refreshing && !cachedAt.IsZero() {
		c.JSON(http.StatusOK, cached)
		return
	}

	// Refresh inline. We allow up to 12s — Telegram getWebhookInfo + Anthropic ping should
	// fit comfortably; failures fall back to last-known values where possible.
	h.mu.Lock()
	if h.refreshing && !h.cachedAt.IsZero() {
		// Lost the race — another goroutine started; serve their cache when ready.
		stale := h.snapshot
		h.mu.Unlock()
		c.JSON(http.StatusOK, stale)
		return
	}
	h.refreshing = true
	h.mu.Unlock()

	ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Second)
	defer cancel()
	fresh := h.compute(ctx)

	h.mu.Lock()
	h.snapshot = fresh
	h.cachedAt = time.Now()
	h.refreshing = false
	h.mu.Unlock()

	c.JSON(http.StatusOK, fresh)
}

func (h *SystemHandler) compute(ctx context.Context) systemHealth {
	out := systemHealth{
		LastReconcileAt: time.Now().UTC(),
		Notes:           []string{},
	}

	baseURL := os.Getenv("PUBLIC_BASE_URL")
	tgStatuses := telegram.EnsureSubscription(ctx, h.db, baseURL)
	out.TelegramSubscriptions = tgStatuses
	out.TelegramSubscriptionsOK = true
	for _, st := range tgStatuses {
		if !st.OK {
			out.TelegramSubscriptionsOK = false
			out.Notes = append(out.Notes, "Telegram webhook subscription bozuk: "+st.ChannelName)
		}
	}
	if len(tgStatuses) == 0 {
		// No active Telegram channels — not a failure, just nothing to check.
		out.TelegramSubscriptionsOK = true
	}

	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	out.AnthropicCheckedAt = time.Now().UTC()
	out.AnthropicOK = pingAnthropic(ctx, anthropicKey)
	if !out.AnthropicOK {
		out.Notes = append(out.Notes, "Anthropic API anahtarı cevap vermiyor — AI önerileri pas geçiyor olabilir")
	}

	return out
}

func pingAnthropic(ctx context.Context, apiKey string) bool {
	if apiKey == "" {
		return false
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 5,
		"messages":   []map[string]string{{"role": "user", "content": "ok"}},
	})
	pingCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(pingCtx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	cl := &http.Client{Timeout: 8 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	return resp.StatusCode == 200
}
