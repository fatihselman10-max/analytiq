-- CRM Customers table
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT '',
    segment INT NOT NULL DEFAULT 4,
    customer_type VARCHAR(100) NOT NULL DEFAULT '',
    customer_type_other VARCHAR(255) NOT NULL DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT '',
    source_detail VARCHAR(255) NOT NULL DEFAULT '',
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    instagram VARCHAR(255) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    orders TEXT NOT NULL DEFAULT '',
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_customers_org_segment ON customers(org_id, segment);
CREATE INDEX idx_customers_org_country ON customers(org_id, country);
CREATE INDEX idx_customers_org_assigned ON customers(org_id, assigned_to);

-- Multi-channel per customer
CREATE TABLE IF NOT EXISTS customer_channels (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL,
    channel_identifier VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_id, channel_type)
);

-- Segment change audit trail
CREATE TABLE IF NOT EXISTS segment_history (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    old_segment INT NOT NULL,
    new_segment INT NOT NULL,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segment_history_org ON segment_history(org_id, changed_at DESC);

-- Add customer linkage and category to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Genel';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(org_id, category);
