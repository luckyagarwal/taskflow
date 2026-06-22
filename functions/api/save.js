// functions/api/save.js
import { TABLES, TOMBSTONE_TTL_MS, upsertStmt, tombstoneStmt, reapStmt } from './_store.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
  });
}

// The current reset generation (0 until the first reset). Bumped by every reset
// so the server can reject writes minted before the wipe.
async function getGeneration(db) {
  try {
    const { results } = await db.prepare(`SELECT value FROM meta WHERE key = ?`).bind('reset_generation').all();
    return results && results.length ? results[0].value : 0;
  } catch {
    // `meta` may not exist yet on a backend that hasn't run the migration.
    return 0;
  }
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

  const { upserts = {}, deletes = {}, generation = null } = body;

  // Reject writes minted before a reset the client hasn't seen yet. This is what
  // stops an offline device's outbox (rows the server never tombstoned because it
  // never knew about them) from resurrecting a wiped database. `generation` is
  // omitted by older clients → treated as current (back-compat).
  const serverGen = await getGeneration(db);
  if (typeof generation === 'number' && generation < serverGen) {
    return json({ success: true, rejected: true, generation: serverGen });
  }

  const stmts = [];
  const now = Date.now();

  try {
    for (const t of TABLES) {
      // 1. Process upserts. The shared helper holds the guarded ON CONFLICT that
      //    resolves last-write-wins by the client's real edit time, so a delayed,
      //    stale write can never clobber a newer record.
      for (const item of upserts[t] || []) {
        if (!item || !item.id) continue;
        stmts.push(upsertStmt(db, t, item, now));
      }

      // 2. Process deletes as soft-delete tombstones (deleted=1) so the deletion
      //    propagates to other devices via incremental sync. Entries may be a
      //    bare id or { id, updatedAt }; same LWW guard applies.
      for (const d of deletes[t] || []) {
        const id = typeof d === 'string' ? d : (d && d.id);
        if (!id) continue;
        stmts.push(tombstoneStmt(db, t, d, now));
      }
    }

    // Reap tombstones past the retention window, batched into this save (one
    // round trip). updated_at is indexed, so the range scan is cheap.
    const purgeCutoff = now - TOMBSTONE_TTL_MS;
    for (const t of TABLES) {
      stmts.push(reapStmt(db, t, purgeCutoff));
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

  // Reset = tombstone every live row, NOT a hard delete. A hard DELETE leaves no
  // trace, so other devices never see the rows in their incremental pull and
  // keep (and can re-sync) the old data. Tombstones with a fresh timestamp make
  // the wipe propagate: every other device pulls deleted=1 and drops them.
  const now = Date.now();
  const stmts = TABLES.map((t) =>
    db.prepare(`UPDATE ${t} SET data = '', updated_at = ?, deleted = 1 WHERE deleted = 0`).bind(now)
  );

  // Bump the reset generation so other devices adopt the wipe and can't replay a
  // pre-reset outbox over it. Read-then-write is fine: resets are rare and manual.
  const nextGen = (await getGeneration(db)) + 1;
  stmts.push(
    db.prepare(`
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind('reset_generation', nextGen)
  );

  try {
    await db.batch(stmts);
  } catch (err) {
    return json({ error: 'Failed to clear server database', details: err.message }, 500);
  }

  return json({ success: true, wipedAt: now, generation: nextGen });
}
