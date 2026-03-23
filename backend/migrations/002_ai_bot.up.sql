-- AI Bot configuration (per organization)
CREATE TABLE IF NOT EXISTS ai_bot_config (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    brand_name VARCHAR(255),
    brand_description TEXT,
    brand_tone VARCHAR(50) DEFAULT 'professional',
    products_services TEXT,
    faq TEXT,
    policies TEXT,
    greeting_message TEXT,
    fallback_message TEXT,
    custom_instructions TEXT,
    token_balance INT DEFAULT 1000,
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id)
);

-- AI Bot conversation logs
CREATE TABLE IF NOT EXISTS ai_bot_logs (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    customer_message TEXT,
    ai_response TEXT,
    tokens_used INT DEFAULT 0,
    model VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_bot_logs_org ON ai_bot_logs(org_id, created_at DESC);
