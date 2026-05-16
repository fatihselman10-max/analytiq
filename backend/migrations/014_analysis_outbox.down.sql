DROP INDEX IF EXISTS idx_analysis_attempts_org;
DROP INDEX IF EXISTS idx_analysis_attempts_message;
DROP TABLE IF EXISTS analysis_attempts;

DROP INDEX IF EXISTS idx_analysis_queue_org_status;
DROP INDEX IF EXISTS idx_analysis_queue_dispatch;
DROP INDEX IF EXISTS uniq_analysis_queue_message;
DROP TABLE IF EXISTS analysis_queue;
