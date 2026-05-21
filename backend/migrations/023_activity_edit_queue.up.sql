-- 023: Aktivite düzenleme + "Yapılacaklar" yolu (Meryem 2026-05-20 feedback)
-- Video 3: Yanlış kumaş kodu yazılınca düzeltme + silme istendi → edit audit fields.
-- Video 1: Onay'da "Henüz yapmadık" yolu → status='queued' (timeline'da görünmez).

ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS edited_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- 'queued' status'ı için ek index yok, varolan filter (status='approved') zaten queued'u dışarıda bırakıyor.
-- Onay→görev→tamamla pipeline'ında queued aktivite "yapılacak" task'iyle bağlanır.
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS source_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activities_source_task ON customer_activities(source_task_id) WHERE source_task_id IS NOT NULL;
