-- Play Streamers: central donation OAuth connections.
-- Run once on the production D1 database before deploying the matching Worker.

CREATE TABLE IF NOT EXISTS donate_oauth_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_user_id TEXT,
  provider_display_name TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  provider_api_key_ciphertext TEXT,
  token_expires_at INTEGER,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  cursor_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_sync_at INTEGER,
  last_event_at INTEGER,
  event_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_donate_oauth_connections_user
  ON donate_oauth_connections(user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_donate_oauth_connections_active_provider
  ON donate_oauth_connections(user_id, provider_id)
  WHERE revoked_at IS NULL;

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-donate-oauth:v1', '1', datetime('now'));
