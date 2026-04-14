-- Fabric catalog (code, name, season, spec + images)
CREATE TABLE IF NOT EXISTS fabrics (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    season VARCHAR(10) NOT NULL DEFAULT '',
    width VARCHAR(30) NOT NULL DEFAULT '',
    composition VARCHAR(255) NOT NULL DEFAULT '',
    gauge VARCHAR(30) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fabrics_org ON fabrics(org_id);
CREATE INDEX IF NOT EXISTS idx_fabrics_season ON fabrics(org_id, season);
CREATE INDEX IF NOT EXISTS idx_fabrics_code_trgm ON fabrics(code varchar_pattern_ops);

-- Images per fabric (binary data in DB, served via /api/v1/fabric-images/:id)
CREATE TABLE IF NOT EXISTS fabric_images (
    id BIGSERIAL PRIMARY KEY,
    fabric_id BIGINT NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    file_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    file_size BIGINT NOT NULL DEFAULT 0,
    file_data BYTEA NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fabric_images_fabric ON fabric_images(fabric_id, sort_order);
