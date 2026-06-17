# TaskFlow D1 Sync Backend — Design Spec

**Date:** 2026-06-17
**Status:** Draft for review
**Author:** brainstorming session

## Goal

Add a real server-side database to TaskFlow so that:

1. **Multi-device sync** — same tasks appear on phone and laptop.
2. **Real backend DB** — data lives in Cloudflare D1, not only the browser.
3. **Backup / durability** — data survives a cleared browser / lost device.

TaskFlow stays **local-first**: the app keeps reading/writing Dexie (IndexedDB) for instant, offline-capable UX. D1 is the shared source of truth that devices sync against. This is the Todoist pattern (local store + `/sync` API + last-write-wins), scaled down to a single-user-per-account app.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Sync model | Local-first, Dexie stays UI source; background sync to D1 |
| Conflict resolution | **Last-write-wins** by `updatedAt` (ms epoch) |
| Deletes | **Tombstones** (`deleted` flag) so deletions propagate |
| Storage style | **Document-blob** — full record stored as JSON per row (Approach A) |
| Sync transport | **Batched** — all dirty records in one request (not per-record) |
| Identity / auth | **Cloudflare Access (Google OAuth)** in front; app trusts `Cf-Access-Authenticated-User-Email` header. No auth code in app. User wires Google IdP in Cloudflare later. |
| Hosting | Cloudflare Pages + Pages Functions + D1 binding |

### Why document-blob over fully normalized (Approach B)

TaskFlow records are document-shaped: a task embeds a `subtasks[]` array and a `labels[]` id array. All filtering/sorting already happens client-side in memory. Normalizing into FK tables would force a large rewrite of `store.jsx`, a separate `subtasks` table, and a migration on every field change — with no benefit for a single-user in-memory app. The blob approach keeps `store.jsx` writes essentially unchanged and the schema stable. The sync protocol is identical either way; only row storage differs.

## Architecture

```
Browser: React + Dexie (local cache, UI source of truth)
   │  app writes to Dexie first  → instant, offline-capable (UX unchanged)
   ▼
Sync engine  (new: src/sync.js)
   │  PUSH dirty records ▲     PULL newer records ▼
   │  reconcile by updatedAt (last-write-wins), apply tombstones
   ▼
Cloudflare Pages Function  (new: functions/api/sync.js)
   │  reads Cf-Access-Authenticated-User-Email → scopes all rows to that user
   ▼
Cloudflare D1  (tasks, projects, labels, sections — document-blob rows)
```

### Data flow

- **App write** — existing `db.tasks.put(...)` / `db.projects.put(...)` etc. stay. Each write is stamped `updatedAt = Date.now()` and marked dirty.
- **Push** — sync engine collects all dirty records across the 4 tables into one `POST /api/sync` body, server upserts them scoped to the user email, dirty flags cleared on success.
- **Pull** — same response returns records changed since the client's stored `since` cursor (other devices' edits); engine merges into Dexie (incoming wins only if `updatedAt` is strictly greater), applies tombstones, updates React state, advances `since`.
- **Identity** — Cloudflare Access verifies Google login and injects the email header; Function trusts it. Missing header → 401.
- **Offline** — app keeps working on Dexie; sync resumes on reconnect.

## D1 Schema

Four tables, identical document-blob shape:

```sql
CREATE TABLE tasks (
  id          TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  data        TEXT NOT NULL,                 -- full JSON record (incl. nested subtasks, labels[])
  updated_at  INTEGER NOT NULL,             -- ms epoch, drives last-write-wins
  deleted     INTEGER NOT NULL DEFAULT 0,   -- tombstone flag
  PRIMARY KEY (user_email, id)
);
CREATE INDEX idx_tasks_user_updated ON tasks(user_email, updated_at);

-- identical definitions for: projects, labels, sections
```

Per-user isolation: `user_email` is part of the primary key and every query filters on it. Pull query: `SELECT ... WHERE user_email = ? AND updated_at > ?`.

Stored in repo as `schema.sql`, applied with `wrangler d1 execute taskflow-db --file=schema.sql`.

## Sync Engine (`src/sync.js`)

- **Dirty tracking** — add an `updatedAt` field to every record on write, and track dirty ids. Simplest implementation: a Dexie `_meta` table (or a `_dirty: 1` field per record cleared after successful push). Decision deferred to the implementation plan; `_dirty` field is the leading candidate (no extra table, queryable via index).
- **Push** — gather dirty records from all 4 tables → `POST /api/sync` body `{ since, changes: { tasks:[...], projects:[...], labels:[...], sections:[...] } }`. On HTTP 200, clear dirty flags for the pushed ids.
- **Pull** — the same response carries `{ now, changes: {...} }` of rows with `updated_at > since`. Merge each into Dexie: apply only if incoming `updatedAt` > local `updatedAt`; if `deleted`, remove locally; then update React state. Persist `since = now` in `localStorage`.
- **Triggers** — on app load; after writes (debounced ~2 s); on the browser `online` event; and on a periodic interval (~30 s). A single-in-flight guard prevents overlapping syncs.
- **Tombstones** — a local delete marks the record `deleted` + `updatedAt` and pushes it; once the push is confirmed, the row may be hard-deleted locally (server keeps the tombstone for other devices).

## Pages Function (`functions/api/sync.js`)

- Single `onRequestPost` handler.
- Read `Cf-Access-Authenticated-User-Email` from request headers. Absent → `401`.
- Parse body `{ since, changes }`. In one D1 batch:
  - Upsert each incoming record:
    `INSERT INTO <table> (id,user_email,data,updated_at,deleted) VALUES (?,?,?,?,?) ON CONFLICT(user_email,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted=excluded.deleted WHERE excluded.updated_at > <table>.updated_at`
  - Select all rows per table `WHERE user_email = ? AND updated_at > ?` (the client's `since`).
- Respond `{ now: <server ms>, changes: { tasks, projects, labels, sections } }`. `now` becomes the client's next `since`.
- Config: `wrangler.toml` (or Pages dashboard) D1 binding named `DB`.

## Migration of existing data

- First sync after deploy: existing Dexie records have no `updatedAt` → backfill `updatedAt = createdAt || Date.now()`, mark all dirty, push up. D1 starts empty per user and fills from the first device.
- The sample `DATA` seed loads only when **both** Dexie and the server are empty for that user (so a returning user with server data never re-seeds samples).

## Error handling

- Sync failures are non-fatal — the app already uses fire-and-forget `.catch(() => {})` on Dexie writes; a failed sync simply retries on the next trigger.
- Network down → stay fully local; queue dirty records.
- `401` (no Access identity) → surface a "sign in" state; app remains usable locally as a fallback (decision: read-only-local vs blocked — default to local-only, no sync).

## Testing

Playwright is a dependency but has no config/specs yet; this work will add `playwright.config.js` + specs:

1. Offline edit → reconnect → record appears server-side (via a second context / direct `/api/sync` GET).
2. Two contexts edit the same task → newer `updatedAt` wins on both after sync.
3. Delete in one context propagates (tombstone) to the other.
4. Fresh user with existing server data gets that data, **not** the sample seed.

A local Pages dev environment (`wrangler pages dev`) with a local D1 binding is required for these tests.

## Out of scope (YAGNI)

- Field-level merge / CRDTs (last-write-wins is sufficient for single-user multi-device).
- Real-time push (WebSockets) — interval + event-based polling is enough.
- Sharing / collaboration between users.
- Server-side query/filter APIs (filtering stays client-side).

## Open items for the implementation plan

- Dirty-tracking mechanism: `_dirty` field vs `_meta` table (leaning `_dirty`).
- Exact debounce / interval constants.
- Whether to hard-delete locally after tombstone confirmation or keep local tombstones.
- `wrangler.toml` vs Pages-dashboard binding configuration for this repo's deploy flow.
