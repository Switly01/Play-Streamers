CREATE TABLE IF NOT EXISTS ps_creator_pages (
  user_id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  draft_json TEXT NOT NULL,
  published_json TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_creator_pages_slug
  ON ps_creator_pages(slug);
