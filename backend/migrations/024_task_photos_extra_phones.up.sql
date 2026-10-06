-- 024: Samet 2026-10-06 istekleri
-- 1) Numune görevine paket fotoğrafı (BYTEA, fabric_images ile aynı yaklaşım; public servis tahmin edilemez token ile)
CREATE TABLE IF NOT EXISTS task_attachments (
    id          BIGSERIAL PRIMARY KEY,
    org_id      BIGINT NOT NULL,
    task_id     BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    file_name   TEXT NOT NULL DEFAULT '',
    file_type   TEXT NOT NULL DEFAULT 'image/jpeg',
    file_size   BIGINT NOT NULL DEFAULT 0,
    file_data   BYTEA NOT NULL,
    created_by  BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

-- 2) Müşteriye ek telefon numaraları (şimdilik sadece kayıt; mesaj eşleştirmede kullanılmıyor)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS extra_phones TEXT[] NOT NULL DEFAULT '{}';
