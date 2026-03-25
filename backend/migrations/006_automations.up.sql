-- Automation rules: trigger-action workflows
CREATE TABLE IF NOT EXISTS automations (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    -- Trigger: when this happens
    trigger_type VARCHAR(50) NOT NULL, -- 'new_conversation', 'message_received', 'status_changed', 'no_reply_timeout'
    -- Conditions (all must match)
    conditions JSONB DEFAULT '[]',
    -- Actions (executed in order)
    actions JSONB DEFAULT '[]',
    -- Stats
    execution_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automations_org ON automations(org_id);
CREATE INDEX idx_automations_trigger ON automations(org_id, trigger_type, is_active);

-- conditions JSONB format:
-- [
--   {"field": "channel_type", "operator": "equals", "value": "instagram"},
--   {"field": "message_content", "operator": "contains", "value": "sipariş"},
--   {"field": "priority", "operator": "equals", "value": "urgent"}
-- ]
--
-- actions JSONB format:
-- [
--   {"type": "assign_agent", "value": "3"},
--   {"type": "set_priority", "value": "high"},
--   {"type": "add_tag", "value": "5"},
--   {"type": "send_message", "value": "Mesajınız alındı, en kısa sürede dönüş yapacağız."},
--   {"type": "set_status", "value": "pending"}
-- ]
