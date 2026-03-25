-- SLA Policies per organization
CREATE TABLE IF NOT EXISTS sla_policies (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    -- Response time targets in minutes per priority
    first_response_urgent INT DEFAULT 5,
    first_response_high INT DEFAULT 15,
    first_response_normal INT DEFAULT 60,
    first_response_low INT DEFAULT 240,
    -- Resolution time targets in minutes per priority
    resolution_urgent INT DEFAULT 60,
    resolution_high INT DEFAULT 240,
    resolution_normal INT DEFAULT 1440,
    resolution_low INT DEFAULT 4320,
    -- Business hours only (skip non-working time from SLA calc)
    business_hours_only BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sla_policies_org ON sla_policies(org_id);
