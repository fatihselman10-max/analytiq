package segment

import (
	"context"
	"fmt"

	"github.com/repliq/backend/internal/database"
)

// Messe otomatik segment kuralları (2026-10-13 "Messe Crm yeni yapılacaklar"):
// fiyat sorma/verme, kartela veya numune → 2 (Aktif); satış → 1 (Satış Olanlar).
// Segment sadece yukarı çıkar (küçük numara = daha iyi), asla düşmez.
var activitySegment = map[string]int{
	// Manuel aktivite + Yeni Görev wizard'ı
	"price_quoted": 2,
	"kartela_sent": 2,
	"sample_sent":  2,
	"order":        1,
	// AI tespitleri (gelen mesaj)
	"price_inquiry":   2,
	"kartela_request": 2,
	"sample_request":  2,
	"order_intent":    1,
	// Personel giden mesaj tespiti
	"shipping_info": 1,
}

// ForActivity aktivite tipinin hedef segmentini döner (0 = kural yok).
func ForActivity(activityType string) int {
	return activitySegment[activityType]
}

// Apply hedef segment mevcut segmentten iyiyse müşteriyi taşır, segment_history ve
// zaman çizelgesine kayıt atar. userID 0 ise sistem değişikliği olarak yazılır.
func Apply(ctx context.Context, db *database.DB, orgID, customerID, userID int64, newSeg int) bool {
	if newSeg <= 0 || customerID == 0 {
		return false
	}
	var oldSeg int
	if err := db.Pool.QueryRow(ctx,
		`SELECT COALESCE(segment, 4) FROM customers WHERE id=$1 AND org_id=$2`, customerID, orgID,
	).Scan(&oldSeg); err != nil || newSeg >= oldSeg {
		return false
	}
	if _, err := db.Pool.Exec(ctx,
		`UPDATE customers SET segment=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
		newSeg, customerID, orgID); err != nil {
		return false
	}
	var changedBy interface{}
	if userID > 0 {
		changedBy = userID
	}
	db.Pool.Exec(ctx,
		`INSERT INTO segment_history (org_id, customer_id, old_segment, new_segment, changed_by)
		 VALUES ($1,$2,$3,$4,$5)`, orgID, customerID, oldSeg, newSeg, changedBy)
	db.Pool.Exec(ctx,
		`INSERT INTO customer_activities (org_id, customer_id, activity_type, title, created_by)
		 VALUES ($1,$2,'segment_change',$3,$4)`,
		orgID, customerID, fmt.Sprintf("Segment degisikligi: %d → %d", oldSeg, newSeg), changedBy)
	return true
}

// ApplyForActivity aktivite tipine göre Apply çağırır.
func ApplyForActivity(ctx context.Context, db *database.DB, orgID, customerID, userID int64, activityType string) bool {
	return Apply(ctx, db, orgID, customerID, userID, ForActivity(activityType))
}
