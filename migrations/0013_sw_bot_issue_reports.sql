CREATE TABLE IF NOT EXISTS sw_bot_issue_reports (
  issue_hash TEXT PRIMARY KEY,
  issue_text TEXT NOT NULL,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_bot_issue_reports_last_seen
  ON sw_bot_issue_reports(last_seen_at);
