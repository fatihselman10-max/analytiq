package instagram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/repliq/backend/internal/database"
	"github.com/repliq/backend/internal/services/channel"
)

// IGAA (Instagram Login) long-lived token 60 günde expire olur. Bu rutin
// otomatik yeniler: graph.instagram.com/refresh_access_token her çağrıda
// 60 gün uzatır. token_refreshed_at 30 günden eskiyse (veya hiç yoksa)
// yeniler, channels.credentials'ı günceller ve ÇALIŞAN provider'ı hot-swap
// eder (restart beklemeden yeni token devreye girer).
//
// 2026-05-08: token sessizce öldü, refresh mekanizması yoktu, 10 gün IG
// kanalı cevap atamadı. Bu rutin o kök sorunun kalıcı çözümü.
const (
	igRefreshInterval  = 24 * time.Hour      // günde 1 kontrol
	igRefreshThreshold = 30 * 24 * time.Hour // 30 günden eski token'ı yenile
)

// StartTokenRefresh günde bir tüm aktif IG kanallarının IGAA token'ını
// gerekiyorsa yeniler. Boot'ta hemen bir tur çalışır.
func StartTokenRefresh(ctx context.Context, db *database.DB, registry *channel.Registry) {
	log.Printf("[ig-token-refresh] başlatıldı (günde 1, eşik 30g)")
	go runTokenRefresh(ctx, db, registry)

	ticker := time.NewTicker(igRefreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runTokenRefresh(ctx, db, registry)
		}
	}
}

func runTokenRefresh(ctx context.Context, db *database.DB, registry *channel.Registry) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, org_id, COALESCE(credentials::text, '{}')
		   FROM channels
		  WHERE type = 'instagram' AND is_active = true`)
	if err != nil {
		log.Printf("[ig-token-refresh] query error: %v", err)
		return
	}
	type chRow struct {
		id, orgID int64
		creds     string
	}
	var list []chRow
	for rows.Next() {
		var r chRow
		if err := rows.Scan(&r.id, &r.orgID, &r.creds); err == nil {
			list = append(list, r)
		}
	}
	rows.Close()

	refreshed := 0
	for _, r := range list {
		var creds map[string]string
		if err := json.Unmarshal([]byte(r.creds), &creds); err != nil {
			continue
		}
		// IGAA token access_token alanında tutulur (IGAA... prefix).
		token := creds["access_token"]
		if token == "" {
			continue
		}

		// Yaş kontrolü: taze ise atla.
		if ts := creds["token_refreshed_at"]; ts != "" {
			if t, err := time.Parse(time.RFC3339, ts); err == nil && time.Since(t) < igRefreshThreshold {
				continue
			}
		}

		newTok, expiresIn, err := refreshIGToken(ctx, token)
		if err != nil {
			log.Printf("[ig-token-refresh] channel=%d org=%d FAILED: %v", r.id, r.orgID, err)
			continue
		}

		creds["access_token"] = newTok
		creds["token_refreshed_at"] = time.Now().UTC().Format(time.RFC3339)
		out, _ := json.Marshal(creds)
		if _, err := db.Pool.Exec(ctx,
			`UPDATE channels SET credentials = $1, updated_at = NOW() WHERE id = $2`,
			string(out), r.id); err != nil {
			log.Printf("[ig-token-refresh] channel=%d DB update FAILED: %v", r.id, err)
			continue
		}

		// Çalışan provider'ı yeni token'la hot-swap et (registry mutex korumalı).
		registry.Register(NewInstagramProvider(creds))
		refreshed++
		log.Printf("[ig-token-refresh] channel=%d token yenilendi (expires_in=%ds ~%dg)", r.id, expiresIn, expiresIn/86400)
	}
	log.Printf("[ig-token-refresh] tur tamam: kanal=%d yenilenen=%d", len(list), refreshed)
}

// refreshIGToken, IGAA long-lived token'ı 60 gün daha uzatır.
func refreshIGToken(ctx context.Context, token string) (string, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	endpoint := "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=" + url.QueryEscape(token)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("status %d: %.300s", resp.StatusCode, string(body))
	}

	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", 0, err
	}
	if out.AccessToken == "" {
		return "", 0, fmt.Errorf("yanıtta access_token boş")
	}
	return out.AccessToken, out.ExpiresIn, nil
}
