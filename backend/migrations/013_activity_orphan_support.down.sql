-- 013_activity_orphan_support.down.sql
DROP INDEX IF EXISTS idx_activities_pending_orphan;
DROP INDEX IF EXISTS idx_activities_conversation;
DROP INDEX IF EXISTS idx_activities_contact;

-- customer_id NOT NULL'a geri çekmek için orphan satırların silinmesi gerekir.
-- Down migration veri kaybına yol açabileceğinden, orphan'ları silmiyoruz; sadece
-- yeni eklenen kolon ve indeksleri kaldırıyoruz. NOT NULL'u geri istersen önce
-- DELETE FROM customer_activities WHERE customer_id IS NULL çalıştır.
ALTER TABLE customer_activities DROP COLUMN IF EXISTS conversation_id;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS contact_id;
