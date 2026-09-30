// Keep table and column names compatible with the existing SQLAlchemy database.
export const schema = `
CREATE TABLE IF NOT EXISTS tasks (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "original_title" TEXT NOT NULL,
  "original_content" TEXT NOT NULL,
  "original_comments" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "generation_status" TEXT NOT NULL,
  "publish_status" TEXT NOT NULL,
  "active_version_id" TEXT,
  "target_account_id" TEXT,
  "publish_policy_override" TEXT,
  "error" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS draft_versions (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "prompt" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generation_runs (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT,
  "source_task_id" TEXT,
  "template_id" TEXT,
  "tool_permissions" TEXT NOT NULL DEFAULT '["web_search"]',
  "skill_snapshot" TEXT NOT NULL DEFAULT '[]',
  "base_version_id" TEXT,
  "base_html" TEXT,
  "parent_run_id" TEXT,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "system_prompt" TEXT NOT NULL,
  "user_prompt" TEXT NOT NULL,
  "partial_html" TEXT NOT NULL,
  "error" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rewrite_templates (
  "id" TEXT PRIMARY KEY,
  "skill_key" TEXT,
  "name" TEXT NOT NULL,
  "style_key" TEXT UNIQUE,
  "description" TEXT NOT NULL,
  "system_prompt" TEXT NOT NULL,
  "user_prompt_template" TEXT NOT NULL,
  "is_builtin" INTEGER NOT NULL,
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "source" TEXT NOT NULL DEFAULT 'user',
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "skill_files" TEXT NOT NULL DEFAULT '[]',
  "triggers" TEXT NOT NULL DEFAULT '[]',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generation_events (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "task_id" TEXT,
  "run_id" TEXT,
  "event_type" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_requests (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "task_id" TEXT,
  "payload_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "error" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media_assets (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT,
  "media_type" TEXT NOT NULL,
  "url" TEXT,
  "local_path" TEXT,
  "mime_type" TEXT,
  "alt_text" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metadata_json" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts_v2 (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "adapter" TEXT NOT NULL,
  "webhook_url" TEXT,
  "entry_url" TEXT,
  "credentials" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "publish_policy" TEXT NOT NULL,
  "daily_slots" TEXT NOT NULL,
  "delay_min" INTEGER NOT NULL,
  "delay_max" INTEGER NOT NULL,
  "branding_enabled" INTEGER NOT NULL,
  "header_html" TEXT,
  "footer_html" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publish_schedules (
  "id" TEXT PRIMARY KEY,
  "task_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "version_id" TEXT,
  "account_revision" TEXT,
  "title_snapshot" TEXT,
  "policy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "scheduled_at" TEXT,
  "idempotency_key" TEXT NOT NULL UNIQUE,
  "attempt_count" INTEGER NOT NULL,
  "next_attempt_at" TEXT,
  "last_error" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publish_attempts (
  "id" TEXT PRIMARY KEY,
  "schedule_id" TEXT NOT NULL,
  "request_summary" TEXT NOT NULL,
  "response_status" INTEGER,
  "error" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publish_events (
  "id" TEXT PRIMARY KEY,
  "schedule_id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_config (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_events_run ON generation_events(run_id,id);
CREATE INDEX IF NOT EXISTS ix_versions_task ON draft_versions(task_id,created_at);
CREATE INDEX IF NOT EXISTS ix_media_task ON media_assets(task_id);
CREATE INDEX IF NOT EXISTS ix_approval_task ON approval_requests(task_id, created_at);
CREATE INDEX IF NOT EXISTS ix_schedule_due ON publish_schedules(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS ix_publish_events_schedule ON publish_events(schedule_id,created_at);
`;
