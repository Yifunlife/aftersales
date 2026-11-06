CREATE TABLE order_progress_links (
  token_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
