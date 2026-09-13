CREATE TABLE IF NOT EXISTS ps_creator_page_analytics_rate (
  rate_key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rate_key, bucket)
);

CREATE INDEX IF NOT EXISTS idx_ps_creator_page_analytics_rate_bucket
  ON ps_creator_page_analytics_rate(bucket);
