CREATE TABLE IF NOT EXISTS donate_webhook_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_event_at INTEGER,
  event_count INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_donate_webhook_connections_user
  ON donate_webhook_connections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donate_webhook_connections_token
  ON donate_webhook_connections(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_donate_webhook_connections_active_provider
  ON donate_webhook_connections(user_id, provider_id)
  WHERE revoked_at IS NULL;

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-donate-bridge:v5', '1', datetime('now'));
