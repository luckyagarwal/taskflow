// functions/api/data.js
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  // `?since=<ms>` → incremental delta (only changed rows, INCLUDING tombstones
  // so deletions propagate). No param → full snapshot of live rows for a fresh
  // client. `serverMax` is the watermark the client stores as its next token.
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get('since');
  const incremental = sinceRaw != null;
  const since = incremental ? Number(sinceRaw) || 0 : 0;

  const out = {};
  let serverMax = since;
  try {
    // Current reset generation; clients compare it against their own to detect a
    // wipe performed on another device. Tolerate a missing `meta` table.
    try {
      const { results } = await db.prepare(`SELECT value FROM meta WHERE key = ?`).bind('reset_generation').all();
      out.generation = results && results.length ? results[0].value : 0;
    } catch {
      out.generation = 0;
    }

    for (const t of TABLES) {
      const query = incremental
        ? db.prepare(`SELECT id, data, updated_at, deleted FROM ${t} WHERE updated_at > ?`).bind(since)
        : db.prepare(`SELECT id, data, updated_at, deleted FROM ${t} WHERE deleted = 0`);
      const { results } = await query.all();
      out[t] = (results || []).map((r) => {
        if (r.updated_at > serverMax) serverMax = r.updated_at;
        const base = r.data ? JSON.parse(r.data) : {};
        return { ...base, id: r.id, updatedAt: r.updated_at, deleted: r.deleted };
      });
    }
  } catch (err) {
    return json({ error: 'Database read failed', details: err.message }, 500);
  }

  out.serverMax = serverMax;
  return json(out);
}
