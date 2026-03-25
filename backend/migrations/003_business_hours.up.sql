-- Business Hours configuration per organization
CREATE TABLE IF NOT EXISTS business_hours (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    timezone VARCHAR(100) DEFAULT 'Europe/Istanbul',
    schedule JSONB DEFAULT '{}',
    away_message TEXT DEFAULT '',
    welcome_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_business_hours_org ON business_hours(org_id);

-- schedule JSONB format:
-- {
--   "monday":    {"enabled": true, "start": "09:00", "end": "18:00"},
--   "tuesday":   {"enabled": true, "start": "09:00", "end": "18:00"},
--   "wednesday": {"enabled": true, "start": "09:00", "end": "18:00"},
--   "thursday":  {"enabled": true, "start": "09:00", "end": "18:00"},
--   "friday":    {"enabled": true, "start": "09:00", "end": "18:00"},
--   "saturday":  {"enabled": false, "start": "10:00", "end": "14:00"},
--   "sunday":    {"enabled": false, "start": "", "end": ""}
-- }
