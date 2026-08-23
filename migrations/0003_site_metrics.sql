-- Play Streamers D1 migration: privacy-conscious site activity counters
-- Run once in Cloudflare > Workers & Pages > D1 > play-streamers-users
-- > Console before (or together with) the Worker 2.6 deployment.

CREATE TABLE IF NOT EXISTS site_visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_id TEXT,
  authenticated INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen
  ON site_visitors(last_seen_at);

INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
VALUES ('schema:play-streamers-site-metrics:v1', '1', datetime('now'));
