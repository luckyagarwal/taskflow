-- Migration: drop the legacy user-partitioned tables and recreate them on the
-- current document-blob schema (single-column PK on id, no user_email).
--
-- Why: the remote D1 was created with the old schema
--   PRIMARY KEY (user_email, id), user_email NOT NULL
-- but functions/api/save.js writes (id, data, updated_at, deleted) with
-- ON CONFLICT(id). Against the composite-PK schema that fails with
--   "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint",
-- so every save returns 500 ("Failed to save changes to server!").
-- CREATE TABLE IF NOT EXISTS in schema.sql can't fix an existing table, so the
-- tables must be recreated. The remote tables are empty, so no data is lost.
--
-- Apply with:
--   wrangler d1 execute taskflow-db --file=migrations/001_remove_user_partitioning.sql --remote

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS labels;
DROP TABLE IF EXISTS sections;

CREATE TABLE tasks (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tasks_updated ON tasks(updated_at);

CREATE TABLE projects (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_projects_updated ON projects(updated_at);

CREATE TABLE labels (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_labels_updated ON labels(updated_at);

CREATE TABLE sections (
  id          TEXT NOT NULL PRIMARY KEY,
  data        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sections_updated ON sections(updated_at);
