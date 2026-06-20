-- Adds the `meta` table backing the reset-generation counter.
-- Apply with: wrangler d1 execute taskflow-db --file=migrations/002_add_reset_generation.sql --remote
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT NOT NULL PRIMARY KEY,
  value INTEGER NOT NULL
);
