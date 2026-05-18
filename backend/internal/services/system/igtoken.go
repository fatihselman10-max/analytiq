package system

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/repliq/backend/internal/database"
)

// StartIGTokenHealthCheck, günlük 09:00 (TR) saatinde tüm aktif Instagram
// kanallarının access_token'ını test eder. Graph API /me endpoint'ine ping atar,
// 200 değilse Sentry'e warning gönderir.
//
// 60 günlük IGAA token süresi dolmadan haberdar olmak için. Patron panel'den
// görmeden önce Sentry alarm verir.
func StartIGTokenHealthCheck(ctx context.Context, db *database.DB) {
	log.Printf("[ig-token-health] başlatıldı (daily 09:00 TR)")

	// Boot'ta hemen bir tur — restart sonrası bekletmesin
	go runIGTokenCheck(ctx, db)

	for {
		next := nextDailyAt(9, 0) // 09:00 TR (UTC+3) → 06:00 UTC
		wait := time.Until(next)
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
			runIGTokenCheck(ctx, db)
		}
	}
}

// nextDailyAt, sonraki TR saat hh:mm değerine kadar geçecek süreyi döner.
// Server UTC, hedef TR (UTC+3) → UTC saat = hh-3.
func nextDailyAt(hourTR, minTR int) time.Time {
	now := time.Now().UTC()
	target := time.Date(now.Year(), now.Month(), now.Day(), hourTR-3, minTR, 0, 0, time.UTC)
	if !target.After(now) {
		target = target.Add(24 * time.Hour)
	}
	return target
}

func runIGTokenCheck(ctx context.Context, db *database.DB) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, org_id, COALESCE(credentials::text, '{}')
		 FROM channels
		 WHERE type = 'instagram' AND is_active = true`,
	)
	if err != nil {
		log.Printf("[ig-token-health] query error: %v", err)
		return
	}
	defer rows.Close()

	checked := 0
	failed := 0
	for rows.Next() {
		var id, orgID int64
		var credsJSON string
		if err := rows.Scan(&id, &orgID, &credsJSON); err != nil {
			continue
		}
		var creds map[string]string
		if err := json.Unmarshal([]byte(credsJSON), &creds); err != nil {
			continue
		}
		token := creds["page_access_token"]
		if token == "" {
			token = creds["access_token"]
		}
		if token == "" {
			continue
		}
		checked++
		if ok, status, body := pingIGToken(ctx, token); !ok {
			failed++
			log.Printf("[ig-token-health] channel=%d org=%d FAILED status=%d body=%.200s", id, orgID, status, body)
			sentry.WithScope(func(scope *sentry.Scope) {
				scope.SetTag("subsystem", "ig-token-health")
				scope.SetTag("channel_id", fmt.Sprintf("%d", id))
				scope.SetTag("org_id", fmt.Sprintf("%d", orgID))
				scope.SetLevel(sentry.LevelWarning)
				scope.SetContext("igtoken", sentry.Context{
					"http_status": status,
					"response":    truncate(body, 200),
				})
				sentry.CaptureMessage(fmt.Sprintf("Instagram token health check failed for channel %d (status=%d) — token expired or invalidated", id, status))
			})
		}
	}
	log.Printf("[ig-token-health] tur tamam: checked=%d failed=%d", checked, failed)
}

// pingIGToken, Instagram Graph API /me endpoint'ine token ile ping atar.
// 200 → ok. 4xx → token expired/invalid. 5xx → API geçici hatası (warn değil, log).
func pingIGToken(ctx context.Context, token string) (bool, int, string) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	url := "https://graph.facebook.com/v21.0/me?access_token=" + token
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, 0, err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	if resp.StatusCode == 200 {
		return true, 200, ""
	}
	// 5xx: API geçici sorunu, alarm verme
	if resp.StatusCode >= 500 {
		log.Printf("[ig-token-health] graph API 5xx (transient): %d", resp.StatusCode)
		return true, resp.StatusCode, string(body)
	}
	return false, resp.StatusCode, string(body)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
