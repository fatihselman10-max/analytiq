CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    assignee VARCHAR(255) NOT NULL DEFAULT '',
    department VARCHAR(100) NOT NULL DEFAULT 'operations',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(20) NOT NULL DEFAULT 'todo',
    due_date DATE,
    completed_at DATE,
    tags TEXT[] DEFAULT '{}',
    notes TEXT[] DEFAULT '{}',
    kpi_weight INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_org_status ON tasks(org_id, status);
