ALTER TABLE work_notifications ADD COLUMN reminded_at INTEGER;
CREATE INDEX notification_overdue ON work_notifications(reminded_at,created_at);
