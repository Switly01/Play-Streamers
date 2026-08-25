CREATE TABLE IF NOT EXISTS ps_stream_runtime (
  user_id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  kick_session_id TEXT NOT NULL,
  broadcaster_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'ended')),
  last_observed_at INTEGER NOT NULL,
  last_subscription_check_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES ps_stream_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ps_stream_runtime_status_observed
  ON ps_stream_runtime(status, last_observed_at);

CREATE TABLE IF NOT EXISTS ps_stream_samples (
  session_id TEXT NOT NULL,
  sample_minute INTEGER NOT NULL,
  viewer_count INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, sample_minute),
  FOREIGN KEY (session_id) REFERENCES ps_stream_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ps_stream_samples_session_observed
  ON ps_stream_samples(session_id, observed_at);

CREATE TABLE IF NOT EXISTS ps_kick_monitor_state (
  user_id TEXT PRIMARY KEY NOT NULL,
  kick_session_id TEXT NOT NULL,
  broadcaster_user_id TEXT,
  last_checked_at INTEGER NOT NULL DEFAULT 0,
  last_subscription_check_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ps_kick_monitor_state_checked
  ON ps_kick_monitor_state(last_checked_at);
