package system

import (
	"context"
	"log"
	"time"

	"github.com/repliq/backend/internal/database"
)

// StartWeeklyMaintenance, haftada bir kez (Pazar 04:00 UTC) DB maintenance görevlerini
// çalıştırır: VACUUM ANALYZE (istatistik güncelleme + bloat temizlik).
//
// Railway Postgres'i autovacuum'a güveniyor ama yoğun INSERT/UPDATE'li tablolar için
// ek olarak manuel ANALYZE planner'ın daha iyi karar almasını sağlar.
func StartWeeklyMaintenance(ctx context.Context, db *database.DB) {
	log.Printf("[maintenance] başlatıldı (haftalık Pazar 04:00 UTC)")

	for {
		next := nextWeeklySunday4UTC()
		wait := time.Until(next)
		log.Printf("[maintenance] bir sonraki tur: %s (yaklaşık %s sonra)",
			next.Format(time.RFC3339), wait.Round(time.Minute))
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
			runVacuum(ctx, db)
		}
	}
}

func nextWeeklySunday4UTC() time.Time {
	now := time.Now().UTC()
	// Sunday = 0
	daysUntilSunday := (int(time.Sunday) - int(now.Weekday()) + 7) % 7
	target := time.Date(now.Year(), now.Month(), now.Day()+daysUntilSunday, 4, 0, 0, 0, time.UTC)
	if !target.After(now) {
		target = target.Add(7 * 24 * time.Hour)
	}
	return target
}

func runVacuum(ctx context.Context, db *database.DB) {
	start := time.Now()
	log.Printf("[maintenance] başlangıç")

	// 1) Çöp Kutusu auto-purge: 30 günden eski deleted_at olan customer_activities gerçek silinir.
	//    Soft-delete penceresi (Ayarlar → Silinenler'den geri al) 30 gün.
	ctx1, cancel1 := context.WithTimeout(ctx, 5*time.Minute)
	if tag, err := db.Pool.Exec(ctx1,
		`DELETE FROM customer_activities
		 WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'`); err != nil {
		log.Printf("[maintenance] trash purge error: %v", err)
	} else if n := tag.RowsAffected(); n > 0 {
		log.Printf("[maintenance] trash purge: %d eski silinmiş aktivite gerçek silindi", n)
	}
	cancel1()

	// 2) VACUUM ANALYZE — tüm tabloları analyze et + bloat temizlik
	log.Printf("[maintenance] VACUUM ANALYZE başlıyor")
	ctx2, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	if _, err := db.Pool.Exec(ctx2, "VACUUM ANALYZE"); err != nil {
		log.Printf("[maintenance] VACUUM ANALYZE error: %v", err)
		return
	}
	log.Printf("[maintenance] tamam (toplam süre=%s)", time.Since(start).Round(time.Second))
}
