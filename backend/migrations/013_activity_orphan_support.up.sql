-- 013_activity_orphan_support.up.sql
-- Müşteri kartı henüz olmayan AI tespitlerinin de pending kuyruğunda durması için.
-- Patron şikayeti (2026-05-16): "AI içerideki tüm mesajları okuyamıyor, sürekli gözünden bir şey kaçıyor."
-- Kök sebep: AnalyzeIncoming `customerID==nil` durumunda early-return ediyordu, Telegram'da %91 orphan conv.

ALTER TABLE customer_activities ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS contact_id      BIGINT;
ALTER TABLE customer_activities ADD COLUMN IF NOT EXISTS conversation_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_activities_contact
  ON customer_activities (org_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_conversation
  ON customer_activities (org_id, conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_pending_orphan
  ON customer_activities (org_id, status, created_at DESC)
  WHERE status = 'pending' AND customer_id IS NULL;
