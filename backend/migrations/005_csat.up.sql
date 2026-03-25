-- CSAT (Customer Satisfaction) surveys
CREATE TABLE IF NOT EXISTS csat_config (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    question TEXT DEFAULT 'Destek deneyiminizi nasıl değerlendirirsiniz?',
    thank_you_message TEXT DEFAULT 'Geri bildiriminiz için teşekkür ederiz!',
    send_delay_minutes INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_csat_config_org ON csat_config(org_id);

CREATE TABLE IF NOT EXISTS csat_responses (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    contact_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
    agent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    channel_type VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csat_responses_org ON csat_responses(org_id);
CREATE INDEX idx_csat_responses_created ON csat_responses(org_id, created_at DESC);
