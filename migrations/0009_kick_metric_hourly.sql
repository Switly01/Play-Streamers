-- Play Streamers: hourly Kick follower/subscriber measurements.
-- Run once on the production D1 database; the Worker also creates this table defensively.
CREATE TABLE IF NOT EXISTS kick_metric_hourly (
  user_id TEXT NOT NULL,
  metric_hour TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  broadcaster_user_id TEXT NOT NULL,
  kick_slug TEXT,
  followers_count INTEGER,
  subscribers_count INTEGER,
  month_followers_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, metric_hour)
);

CREATE INDEX IF NOT EXISTS idx_kick_metric_hourly_user_date
  ON kick_metric_hourly(user_id, metric_date, metric_hour);

CREATE INDEX IF NOT EXISTS idx_kick_metric_hourly_broadcaster_date
  ON kick_metric_hourly(broadcaster_user_id, metric_date, metric_hour);

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-kick-metrics:v2', '1', datetime('now'));
