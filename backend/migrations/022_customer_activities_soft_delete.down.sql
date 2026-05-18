DROP INDEX IF EXISTS idx_customer_activities_trash;
DROP INDEX IF EXISTS idx_customer_activities_active;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE customer_activities DROP COLUMN IF EXISTS deleted_at;
