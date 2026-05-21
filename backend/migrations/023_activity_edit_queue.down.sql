DROP INDEX IF EXISTS idx_activities_source_task;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS source_task_id;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS edited_by;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS edited_at;
