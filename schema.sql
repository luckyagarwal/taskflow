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
