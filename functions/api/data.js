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
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  const out = {};
  try {
    for (const t of TABLES) {
      const { results } = await db.prepare(`SELECT id, data FROM ${t} WHERE deleted = 0`).all();
      out[t] = (results || []).map((r) => ({
        id: r.id,
        ...JSON.parse(r.data)
      }));
    }
  } catch (err) {
    return json({ error: 'Database read failed', details: err.message }, 500);
  }

  return json(out);
}
