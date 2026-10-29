ALTER TABLE work_notifications ADD COLUMN snapshot TEXT;
CREATE TABLE notification_deliveries(job_id TEXT NOT NULL,userid TEXT NOT NULL,sent_at INTEGER NOT NULL,msgid TEXT,PRIMARY KEY(job_id,userid));
