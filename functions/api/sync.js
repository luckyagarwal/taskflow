// Cloudflare Pages Function: POST /api/sync
//
// Local-first sync endpoint. Identity comes from Cloudflare Access (Google OAuth)
// via the Cf-Access-Authenticated-User-Email header — no auth code here, the app
// just trusts the verified header. Every row is scoped to that email.
//
// Request body:  { since: <ms>, changes: { tasks:[...], projects:[...], labels:[...], sections:[...] } }
//   each change: { id, data: <object|null>, updatedAt: <ms>, deleted: 0|1 }
// Response:      { now: <ms>, changes: { <table>: [ { id, data, updated_at, deleted } ] } }
//
// Conflict resolution is last-write-wins: an incoming row only overwrites an
// existing one when its updatedAt is strictly greater (enforced in the UPSERT).

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

  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) return new Response('Unauthorized', {
    status: 401,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });

  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const since = Number(body.since) || 0;
  const changes = body.changes || {};

  // 1. Upsert all incoming records in one batch (last-write-wins guard in WHERE).
  const stmts = [];
  for (const t of TABLES) {
    const recs = Array.isArray(changes[t]) ? changes[t] : [];
    for (const rec of recs) {
      if (!rec || typeof rec.id !== 'string') continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO ${t} (id, user_email, data, updated_at, deleted)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_email, id) DO UPDATE SET
               data = excluded.data,
               updated_at = excluded.updated_at,
               deleted = excluded.deleted
             WHERE excluded.updated_at > ${t}.updated_at`
          )
          .bind(
            rec.id,
            email,
            rec.data == null ? null : JSON.stringify(rec.data),
            Number(rec.updatedAt) || Date.now(),
            rec.deleted ? 1 : 0
          )
      );
    }
  }
  if (stmts.length) await db.batch(stmts);

  // 2. Pull everything changed since the client's cursor.
  const out = {};
  for (const t of TABLES) {
    const { results } = await db
      .prepare(`SELECT id, data, updated_at, deleted FROM ${t} WHERE user_email = ? AND updated_at > ?`)
      .bind(email, since)
      .all();
    out[t] = (results || []).map((r) => ({
      id: r.id,
      data: r.data ? JSON.parse(r.data) : null,
      updated_at: r.updated_at,
      deleted: r.deleted,
    }));
  }

  return json({ now: Date.now(), changes: out });
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) return new Response('Unauthorized', {
    status: 401,
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });

  const db = env.DB;
  if (!db) return json({ error: 'D1 binding "DB" not configured' }, 500);

  const stmts = TABLES.map((t) => 
    db.prepare(`DELETE FROM ${t} WHERE user_email = ?`).bind(email)
  );

  try {
    await db.batch(stmts);
  } catch (err) {
    return json({ error: 'Failed to clear server database', details: err.message }, 500);
  }

  return json({ success: true, wipedAt: Date.now() });
}

