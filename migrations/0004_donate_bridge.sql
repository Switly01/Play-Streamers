-- Play Streamers D1 migration: Donate Bridge device pairing and verified events.
-- Run once before deploying the Worker version that exposes Donate Bridge.

CREATE TABLE IF NOT EXISTS donate_bridge_pairing_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_donate_bridge_pairing_user
  ON donate_bridge_pairing_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donate_bridge_pairing_expiry
  ON donate_bridge_pairing_codes(expires_at);

CREATE TABLE IF NOT EXISTS donate_bridge_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  app_version TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_donate_bridge_devices_user
  ON donate_bridge_devices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donate_bridge_devices_token
  ON donate_bridge_devices(token_hash);

CREATE TABLE IF NOT EXISTS donate_bridge_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  message TEXT,
  event_at INTEGER,
  observed_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  integrity_hash TEXT,
  received_at INTEGER NOT NULL,
  UNIQUE(user_id, provider_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_donate_bridge_events_user_received
  ON donate_bridge_events(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_donate_bridge_events_device_received
  ON donate_bridge_events(device_id, received_at DESC);

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-donate-bridge:v1', '1', datetime('now'));
