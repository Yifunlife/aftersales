CREATE TABLE work_recycle(archive_id TEXT PRIMARY KEY,work_id TEXT NOT NULL,row_json TEXT NOT NULL,reason TEXT NOT NULL,removed_by TEXT NOT NULL,removed_at INTEGER NOT NULL,restored_at INTEGER);
CREATE UNIQUE INDEX work_recycle_active ON work_recycle(work_id) WHERE restored_at IS NULL;
