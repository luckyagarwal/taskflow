// GET /api/health — binding diagnostic. Reports only whether the D1 binding is
// present (boolean), never any data. Safe to expose; remove once verified.
export async function onRequestGet(context) {
  const hasDB = Boolean(context.env && context.env.DB);
  let canQuery = false;
  if (hasDB) {
    try {
      await context.env.DB.prepare("SELECT 1").all();
      canQuery = true;
    } catch {
      canQuery = false;
    }
  }
  return new Response(JSON.stringify({ db_bound: hasDB, db_query_ok: canQuery, ts: Date.now() }), {
    headers: { "Content-Type": "application/json" },
  });
}
