// functions/api/save.js
const TABLES = ['tasks', 'projects', 'labels', 'sections'];

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
      // 1. Process upserts
      const upList = upserts[t] || [];
      for (const item of upList) {
        if (!item || !item.id) continue;
        const dataStr = JSON.stringify(item);
        stmts.push(
          db.prepare(`
            INSERT INTO ${t} (id, data, updated_at, deleted)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(id) DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at,
              deleted = 0
          `).bind(item.id, dataStr, now)
        );
      }

      // 2. Process deletes (physical delete is cleaner for online-only)
      const delList = deletes[t] || [];
      for (const id of delList) {
        if (!id) continue;
        stmts.push(
          db.prepare(`DELETE FROM ${t} WHERE id = ?`).bind(id)
        );
      }
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
