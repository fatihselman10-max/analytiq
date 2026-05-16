-- 014_analysis_outbox.up.sql
-- AI analiz outbox pattern. Webhook handler artık direkt analyze etmiyor; bunun yerine
-- mesajla aynı transaction'da analysis_queue'ya yazıyor. Background worker 5sn interval ile
-- kuyrukta bekleyen mesajları işler, retry/backoff ile dayanıklı.
--
-- Niye: 2026-05-16 patron şikayeti "AI sürekli mesaj kaçırıyor"; in-handler `go` goroutine
-- crash/timeout/Haiku rate-limit durumlarında kayba yol açıyordu. Outbox ile mesaj DB'ye
-- düştüyse analiz garantili.

CREATE TABLE IF NOT EXISTS analysis_queue (
  id              BIGSERIAL PRIMARY KEY,
  org_id          BIGINT NOT NULL,
  message_id      BIGINT NOT NULL,
  -- (org_id, message_id) UNIQUE: aynı mesaj iki kez enqueue edilemez
  -- (idempotent — duplicate webhook delivery'lere karşı korur)
  enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count   INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending', -- pending / processing / done / failed
  last_error      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_analysis_queue_message
  ON analysis_queue (org_id, message_id);

-- Worker ana sorgusu: hazır pending'leri çekerken hızlı olmalı
CREATE INDEX IF NOT EXISTS idx_analysis_queue_dispatch
  ON analysis_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

-- Coverage dashboard için
CREATE INDEX IF NOT EXISTS idx_analysis_queue_org_status
  ON analysis_queue (org_id, status, enqueued_at DESC);


CREATE TABLE IF NOT EXISTS analysis_attempts (
  id                    BIGSERIAL PRIMARY KEY,
  org_id                BIGINT NOT NULL,
  message_id            BIGINT NOT NULL,
  attempted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms           INT NOT NULL DEFAULT 0,
  matched_by            TEXT,           -- 'rule:<type>' / 'haiku' / 'none'
  produced_activity_id  BIGINT,
  error                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_analysis_attempts_message
  ON analysis_attempts (message_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_attempts_org
  ON analysis_attempts (org_id, attempted_at DESC);
