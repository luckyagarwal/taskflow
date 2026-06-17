-- TaskFlow D1 schema — document-blob, one row per record, per-user scoped.
-- Apply with: wrangler d1 execute taskflow-db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  data        TEXT,                          -- full JSON record (null for tombstones)
  updated_at  INTEGER NOT NULL,             -- ms epoch, drives last-write-wins
  deleted     INTEGER NOT NULL DEFAULT 0,   -- tombstone flag
  PRIMARY KEY (user_email, id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks(user_email, updated_at);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, id)
);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_email, updated_at);

CREATE TABLE IF NOT EXISTS labels (
  id          TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, id)
);
CREATE INDEX IF NOT EXISTS idx_labels_user_updated ON labels(user_email, updated_at);

CREATE TABLE IF NOT EXISTS sections (
  id          TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, id)
);
CREATE INDEX IF NOT EXISTS idx_sections_user_updated ON sections(user_email, updated_at);
