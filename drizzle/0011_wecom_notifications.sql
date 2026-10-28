CREATE TABLE IF NOT EXISTS notification_settings (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
INSERT OR IGNORE INTO notification_settings VALUES ('wecom',0,0);
CREATE TABLE IF NOT EXISTS notification_members (employee_id TEXT PRIMARY KEY REFERENCES employees(id), wecom_userid TEXT NOT NULL UNIQUE, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notification_routes (stage TEXT NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), PRIMARY KEY(stage,employee_id));
CREATE TABLE IF NOT EXISTS work_notifications (
 id TEXT PRIMARY KEY, work_id TEXT NOT NULL, work_table TEXT NOT NULL, work_version INTEGER NOT NULL,
 stage TEXT NOT NULL, owner TEXT NOT NULL, actor TEXT NOT NULL, work_no TEXT NOT NULL,
 status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL, sent_at INTEGER, msgid TEXT,
 UNIQUE(work_id,work_version)
);
CREATE INDEX IF NOT EXISTS notification_pending ON work_notifications(status,next_at);
