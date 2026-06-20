-- TaskFlow D1 schema — document-blob, one row per record.
-- Apply with: wrangler d1 execute taskflow-db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,                          -- full JSON record (null for tombstones)
  updated_at  INTEGER NOT NULL,             -- ms epoch, drives last-write-wins
  deleted     INTEGER NOT NULL DEFAULT 0    -- tombstone flag
);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

CREATE TABLE IF NOT EXISTS labels (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_labels_updated ON labels(updated_at);

CREATE TABLE IF NOT EXISTS sections (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sections_updated ON sections(updated_at);

-- Key/value server metadata. Holds `reset_generation`: a monotonic counter bumped
-- by every reset (DELETE /api/save). Clients store the generation they last saw;
-- a write minted in a pre-reset world (lower generation) is rejected, and a client
-- that pulls a higher generation wipes its local store + outbox to adopt the reset.
-- This covers what tombstones cannot: rows the server has never seen (an offline
-- device's outbox) can no longer resurrect a wiped database.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT NOT NULL PRIMARY KEY,
  value INTEGER NOT NULL
);
