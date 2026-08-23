-- Play Streamers: daily Kick follower/subscriber snapshots.
-- The Worker also creates this table defensively; this migration may be run once
-- on the production D1 database before deploying the matching Worker.
CREATE TABLE IF NOT EXISTS kick_metric_snapshots (
  user_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  broadcaster_user_id TEXT NOT NULL,
  kick_slug TEXT,
  followers_count INTEGER,
  subscribers_count INTEGER,
  source TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_kick_metric_snapshots_user_date
  ON kick_metric_snapshots(user_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_kick_metric_snapshots_broadcaster_date
  ON kick_metric_snapshots(broadcaster_user_id, metric_date DESC);

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-kick-metrics:v1', '1', datetime('now'));
