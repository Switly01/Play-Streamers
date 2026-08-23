ALTER TABLE users ADD COLUMN sw_identity_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sw_identity_user_id
  ON users(sw_identity_user_id)
  WHERE sw_identity_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ps_user_entitlements (
  user_id TEXT PRIMARY KEY NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'product-pro')),
  status TEXT NOT NULL,
  identity_version TEXT,
  source TEXT NOT NULL,
  expires_at INTEGER,
  synced_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ps_feature_settings (
  user_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, feature_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ps_stream_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  interactions INTEGER NOT NULL DEFAULT 0,
  followers_gained INTEGER NOT NULL DEFAULT 0,
  revenue_minor INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ps_stream_sessions_user_started
  ON ps_stream_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ps_ai_insights (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_ai_insights_cache
  ON ps_ai_insights(user_id, insight_type, input_hash);

CREATE INDEX IF NOT EXISTS idx_ps_ai_insights_expires
  ON ps_ai_insights(expires_at);
