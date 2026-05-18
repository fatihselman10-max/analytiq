package system

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/activity"
	"github.com/repliq/backend/internal/services/channel/instagram"
	"github.com/repliq/backend/internal/services/channel/telegram"
	vkprovider "github.com/repliq/backend/internal/services/channel/vk"
)

// Health captures the overall liveness of the system. Updated on a hourly tick so the
// panel can render a reassuring "everything flowing" indicator without each request
// triggering external API calls.
type Health struct {
	LastReconcileAt    time.Time              `json:"last_reconcile_at"`
	LastWarmupAt       *time.Time             `json:"last_warmup_at,omitempty"`
	AnthropicOK        bool                   `json:"anthropic_ok"`
	AnthropicCheckedAt time.Time              `json:"anthropic_checked_at"`
	TelegramSubsOK     bool                   `json:"telegram_subscriptions_ok"`
	TelegramDetail     []telegram.SubscriptionStatus `json:"telegram_subscriptions"`
	BackfilledTasks    int                    `json:"backfilled_tasks"`
	BackfilledCustomers int                   `json:"backfilled_customers"`
	BackfillScanned    int                    `json:"backfill_scanned"`
	Notes              []string               `json:"notes"`
}

type Reconciler struct {
	db              *database.DB
	activitySvc     *activity.Service
	igPoller        *instagram.Poller
	vkPoller        *vkprovider.Poller
	anthropicAPIKey string
	tgBaseURL       string

	mu     sync.RWMutex
	latest Health
}

func NewReconciler(db *database.DB, activitySvc *activity.Service, igPoller *instagram.Poller,
	vkPoller *vkprovider.Poller, anthropicAPIKey, tgBaseURL string) *Reconciler {
	return &Reconciler{
		db:              db,
		activitySvc:     activitySvc,
		igPoller:        igPoller,
		vkPoller:        vkPoller,
		anthropicAPIKey: anthropicAPIKey,
		tgBaseURL:       tgBaseURL,
	}
}

// Snapshot returns the most recent Health computed by Run/Warmup. Cheap, panel-safe.
func (r *Reconciler) Snapshot() Health {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.latest
}

// Run performs a lightweight reconciliation: re-assert subscriptions, ensure pollers nudged,
// catch up unlinked messages with AI. Designed to run hourly.
func (r *Reconciler) Run(ctx context.Context, isWarmup bool) Health {
	h := Health{LastReconcileAt: time.Now().UTC(), Notes: []string{}}

	// 1. Telegram subscription enforcement
	tgStatuses := telegram.EnsureSubscription(ctx, r.db, r.tgBaseURL)
	h.TelegramDetail = tgStatuses
	h.TelegramSubsOK = true
	for _, st := range tgStatuses {
		if !st.OK {
			h.TelegramSubsOK = false
			h.Notes = append(h.Notes, fmt.Sprintf("Telegram channel=%d subscription bozuk: %v", st.ChannelID, st.MissingUpdates))
		}
		if st.Reconfigured {
			h.Notes = append(h.Notes, fmt.Sprintf("Telegram channel=%d webhook otomatik düzeltildi", st.ChannelID))
		}
	}

	// 2. AI provider health (silent failure is the worst — verify the key still works)
	h.AnthropicOK = r.pingAnthropic(ctx)
	h.AnthropicCheckedAt = time.Now().UTC()
	if !h.AnthropicOK {
		h.Notes = append(h.Notes, "Anthropic API anahtarı cevap vermiyor — AI önerileri pas geçiyor olabilir")
	}

	// 3. Catch-up: any unlinked conversations whose AI never fired (every org, but in
	// practice only org_id=1 has org-level AI today). Backfill is idempotent.
	if isWarmup {
		// Larger window for the daily warmup
		var orgs []int64
		rows, _ := r.db.Pool.Query(ctx, `SELECT id FROM organizations WHERE plan != 'disabled'`)
		if rows != nil {
			for rows.Next() {
				var oid int64
				if err := rows.Scan(&oid); err == nil {
					orgs = append(orgs, oid)
				}
			}
			rows.Close()
		}
		for _, orgID := range orgs {
			t, c, s := r.activitySvc.BackfillUnlinked(orgID)
			h.BackfilledTasks += t
			h.BackfilledCustomers += c
			h.BackfillScanned += s
		}
		now := time.Now().UTC()
		h.LastWarmupAt = &now
	}

	r.mu.Lock()
	if h.LastWarmupAt == nil {
		h.LastWarmupAt = r.latest.LastWarmupAt
	}
	r.latest = h
	r.mu.Unlock()

	log.Printf("[RECONCILE] tg_ok=%v anthropic_ok=%v warmup=%v backfilled_tasks=%d notes=%v",
		h.TelegramSubsOK, h.AnthropicOK, isWarmup, h.BackfilledTasks, h.Notes)

	return h
}

// pingAnthropic does a tiny Haiku call to verify the API key is still valid + reachable.
// Returns true on 200, false otherwise (network errors, 401, 5xx).
func (r *Reconciler) pingAnthropic(ctx context.Context) bool {
	if r.anthropicAPIKey == "" {
		return false
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model":      "claude-haiku-4-5-20251001",
		"max_tokens": 5,
		"messages":   []map[string]string{{"role": "user", "content": "ok"}},
	})
	pingCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(pingCtx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", r.anthropicAPIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	cl := &http.Client{Timeout: 10 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	return resp.StatusCode == 200
}

// Schedule starts two background tickers:
//   - Hourly Run() — keeps subscriptions tight, AI pinged
//   - Daily 06:30 Turkey time Warmup — proactively repairs anything missed overnight
//     so personnel arriving at ~08:00 see a clean slate
//
// Survives until ctx is cancelled. Does not block.
func (r *Reconciler) Schedule(ctx context.Context) {
	go func() {
		// Initial run shortly after boot
		time.Sleep(20 * time.Second)
		r.Run(context.Background(), false)
	}()

	// Hourly reconcile
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				rctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
				r.Run(rctx, false)
				cancel()
			}
		}
	}()

	// Daily warmup at 05:30 Turkey time. Falls back to 02:30 UTC if Europe/Istanbul TZ
	// data unavailable (= same wall clock 05:30 TR). Targets personnel ~08:00 arrival
	// so anything overnight is reconciled before the office opens.
	go func() {
		loc, tzErr := time.LoadLocation("Europe/Istanbul")
		if tzErr != nil {
			loc = time.FixedZone("TR", 3*3600)
			log.Printf("[RECONCILE] tzdata yok, sabit UTC+3 kullanılıyor")
		}
		for {
			now := time.Now().In(loc)
			next := time.Date(now.Year(), now.Month(), now.Day(), 5, 30, 0, 0, loc)
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			wait := next.Sub(now)
			log.Printf("[RECONCILE] sonraki sabah warmup: %s TR (%v sonra)", next.Format("2006-01-02 15:04 -0700"), wait.Round(time.Minute))
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
				rctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				r.Run(rctx, true)
				cancel()
			}
		}
	}()
}
