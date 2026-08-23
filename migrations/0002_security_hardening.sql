-- Play Streamers D1 migration: security hardening
-- Run this once in Cloudflare > Workers & Pages > D1 > play-streamers-users
-- > Console. The Worker keeps a backwards-compatible automatic schema check,
-- but this file makes production database changes reviewable and repeatable.

CREATE TABLE IF NOT EXISTS kick_refresh_locks (
  session_id TEXT PRIMARY KEY,
  locked_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kick_refresh_locks_expires_at
  ON kick_refresh_locks(locked_until);

-- The Worker adds users.password_iterations automatically during its
-- backwards-compatible schema bootstrap. It is deliberately not repeated
-- here because SQLite/D1 has no portable ADD COLUMN IF NOT EXISTS form.

-- Remove stale locks left by an interrupted request.
DELETE FROM kick_refresh_locks
  WHERE locked_until <= unixepoch() * 1000;
