-- Migration 022 (2026-05-18): customer_activities soft-delete + "Çöp Kutusu" desteği
-- Hard-delete yerine deleted_at flag; 30 gün sonra weekly cron tarafından gerçek silinir.
-- Personel yanlışlıkla silerse Ayarlar → Silinenler sayfasından Geri Al ile kurtarır.

ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- "Aktif kayıt" listelemesi için partial index (deleted_at IS NULL filter performansı)
CREATE INDEX IF NOT EXISTS idx_customer_activities_active
  ON customer_activities(org_id, customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- "Çöp kutusu" listelemesi için
CREATE INDEX IF NOT EXISTS idx_customer_activities_trash
  ON customer_activities(org_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;
