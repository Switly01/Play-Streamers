CREATE TABLE IF NOT EXISTS ps_creator_page_analytics (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day, metric_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ps_creator_page_analytics_day
  ON ps_creator_page_analytics(user_id, day);
