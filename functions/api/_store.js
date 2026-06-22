// functions/api/_store.js
// Shared D1 write helpers: the one place that knows how a record upsert, a
// soft-delete tombstone, and a tombstone reap are spelled in SQL. Both the
// app's save endpoint (save.js) and the WhatsApp webhook write through these,
// so last-write-wins conflict rules are identical no matter who writes.
//
// Underscore-prefixed: Cloudflare Pages ignores it as a route but it can be
// imported by the real route files.

export const TABLES = ['tasks', 'projects', 'labels', 'sections'];

// How long soft-delete tombstones are retained before being reaped. Must exceed
// any realistic offline gap, so a device that's been offline still learns about
// a deletion via incremental sync before the tombstone is purged.
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Upsert one record. The caller supplies `updatedAt` on the item (the real edit
// time) so last-write-wins resolves by when the edit happened, not when the
// request landed. The guarded ON CONFLICT means a delayed, stale write can never
// clobber a newer record.
export function upsertStmt(db, table, item, now = Date.now()) {
  const ts = typeof item.updatedAt === 'number' ? item.updatedAt : now;
  const dataStr = JSON.stringify(item);
  return db.prepare(`
            INSERT INTO ${table} (id, data, updated_at, deleted)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(id) DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at,
              deleted = 0
            WHERE excluded.updated_at >= ${table}.updated_at
          `).bind(item.id, dataStr, ts);
}

// Soft-delete one record as a tombstone (deleted=1) so the deletion propagates
// to other devices via incremental sync. `entry` may be a bare id or
// { id, updatedAt }; same LWW guard applies.
export function tombstoneStmt(db, table, entry, now = Date.now()) {
  const id = typeof entry === 'string' ? entry : (entry && entry.id);
  const ts = (entry && typeof entry.updatedAt === 'number') ? entry.updatedAt : now;
  return db.prepare(`
            INSERT INTO ${table} (id, data, updated_at, deleted)
            VALUES (?, '', ?, 1)
            ON CONFLICT(id) DO UPDATE SET
              updated_at = excluded.updated_at,
              deleted = 1
            WHERE excluded.updated_at >= ${table}.updated_at
          `).bind(id, ts);
}

// Reap tombstones past the retention window. updated_at is indexed, so the range
// scan is cheap.
export function reapStmt(db, table, cutoff) {
  return db.prepare(`DELETE FROM ${table} WHERE deleted = 1 AND updated_at < ?`).bind(cutoff);
}
