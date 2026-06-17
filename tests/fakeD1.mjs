// Minimal in-memory D1 stand-in that understands exactly the two SQL shapes
// used by functions/api/sync.js: the LWW UPSERT and the pull-since SELECT.
// Lets us exercise the real Pages Function without Cloudflare.

export function makeFakeD1(store = new Map()) {
  const key = (table, user, id) => `${table}|${user}|${id}`;

  function prepare(sql) {
    const stmt = {
      _args: [],
      bind(...args) { this._args = args; return this; },
      async all() {
        const table = sql.match(/FROM (\w+)/)[1];
        const [user, since] = this._args;
        const results = [];
        for (const v of store.values()) {
          if (v.table === table && v.user === user && v.updated_at > since) {
            results.push({ id: v.id, data: v.data, updated_at: v.updated_at, deleted: v.deleted });
          }
        }
        return { results };
      },
      async run() {
        const table = sql.match(/INSERT INTO (\w+)/)[1];
        const [id, user, data, updated_at, deleted] = this._args;
        const k = key(table, user, id);
        const cur = store.get(k);
        // LWW: only overwrite when strictly newer (mirrors the SQL WHERE clause).
        if (!cur || updated_at > cur.updated_at) {
          store.set(k, { table, user, id, data, updated_at, deleted });
        }
        return { success: true };
      },
    };
    return stmt;
  }

  return {
    _store: store,
    prepare,
    async batch(stmts) { for (const s of stmts) await s.run(); return []; },
  };
}
