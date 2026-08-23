CREATE TABLE IF NOT EXISTS account_login_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  browser_name TEXT,
  operating_system TEXT,
  city TEXT,
  country TEXT,
  latitude REAL,
  longitude REAL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_account_login_devices_user_seen
  ON account_login_devices(user_id, last_seen_at DESC);

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-account-devices:v1', '1', datetime('now'));
