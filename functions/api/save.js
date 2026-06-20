// functions/api/save.js
const TABLES = ['tasks', 'projects', 'labels', 'sections'];

// How long soft-delete tombstones are retained before being reaped. Must exceed
// any realistic offline gap, so a device that's been offline still learns about
// a deletion via incremental sync before the tombstone is purged.
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { upserts = {}, deletes = {} } = body;
  const stmts = [];
  const now = Date.now();

  try {
    for (const t of TABLES) {
      // 1. Process upserts. The client supplies `updatedAt` (the real edit time)
      //    so last-write-wins resolves by when the edit happened, not when the
      //    request happened to land. The guarded ON CONFLICT means a delayed,
      //    stale write can never clobber a newer record.
      const upList = upserts[t] || [];
      for (const item of upList) {
        if (!item || !item.id) continue;
        const ts = typeof item.updatedAt === 'number' ? item.updatedAt : now;
        const dataStr = JSON.stringify(item);
        stmts.push(
          db.prepare(`
            INSERT INTO ${t} (id, data, updated_at, deleted)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(id) DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at,
              deleted = 0
            WHERE excluded.updated_at >= ${t}.updated_at
          `).bind(item.id, dataStr, ts)
        );
      }

      // 2. Process deletes as soft-delete tombstones (deleted=1) so the deletion
      //    propagates to other devices via incremental sync. Entries may be a
      //    bare id or { id, updatedAt }; same LWW guard applies.
      const delList = deletes[t] || [];
      for (const d of delList) {
        const id = typeof d === 'string' ? d : (d && d.id);
        if (!id) continue;
        const ts = (d && typeof d.updatedAt === 'number') ? d.updatedAt : now;
        stmts.push(
          db.prepare(`
            INSERT INTO ${t} (id, data, updated_at, deleted)
            VALUES (?, '', ?, 1)
            ON CONFLICT(id) DO UPDATE SET
              updated_at = excluded.updated_at,
              deleted = 1
            WHERE excluded.updated_at >= ${t}.updated_at
          `).bind(id, ts)
        );
      }
    }

    // Reap tombstones past the retention window, batched into this save (one
    // round trip). updated_at is indexed, so the range scan is cheap.
    const purgeCutoff = now - TOMBSTONE_TTL_MS;
    for (const t of TABLES) {
      stmts.push(db.prepare(`DELETE FROM ${t} WHERE deleted = 1 AND updated_at < ?`).bind(purgeCutoff));
    }

    if (stmts.length) {
      await db.batch(stmts);
    }
  } catch (err) {
    return json({ error: 'Failed to write to database', details: err.message }, 500);
  }

  return json({ success: true, timestamp: now });
}

export async function onRequestDelete(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  const stmts = TABLES.map((t) => 
    db.prepare(`DELETE FROM ${t}`)
  );

  try {
    await db.batch(stmts);
  } catch (err) {
    return json({ error: 'Failed to clear server database', details: err.message }, 500);
  }

  return json({ success: true, wipedAt: Date.now() });
}
