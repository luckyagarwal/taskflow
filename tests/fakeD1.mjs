// Minimal in-memory D1 stand-in that understands exactly the SQL shapes
// used by the new online-only data, save, and events endpoints.

export function makeFakeD1(store = new Map()) {
  const key = (table, id) => `${table}|${id}`;

  function prepare(sql) {
    const stmt = {
      _args: [],
      bind(...args) { this._args = args; return this; },
      async all() {
        // Handle max updated_at query (for SSE events)
        if (sql.includes("MAX(val)")) {
          let maxVal = 0;
          for (const v of store.values()) {
            if (v.updated_at > maxVal) {
              maxVal = v.updated_at;
            }
          }
          return { results: [{ max_val: maxVal }] };
        }

        // Handle SELECT id, data FROM table WHERE deleted = 0
        const tableMatch = sql.match(/FROM (\w+)/);
        if (!tableMatch) return { results: [] };
        const table = tableMatch[1];
        
        const results = [];
        for (const v of store.values()) {
          if (v.table === table && !v.deleted) {
            results.push({ id: v.id, data: v.data });
          }
        }
        return { results };
      },
      async run() {
        if (sql.includes("DELETE FROM")) {
          const tableMatch = sql.match(/DELETE FROM (\w+)/);
          if (!tableMatch) return { success: false };
          const table = tableMatch[1];
          
          if (sql.includes("WHERE id = ?")) {
            const [id] = this._args;
            const k = key(table, id);
            store.delete(k);
          } else {
            // Wipe whole table
            for (const [k, v] of store.entries()) {
              if (v.table === table) {
                store.delete(k);
              }
            }
          }
          return { success: true };
        }

        if (sql.includes("INSERT INTO")) {
          const tableMatch = sql.match(/INSERT INTO (\w+)/);
          if (!tableMatch) return { success: false };
          const table = tableMatch[1];
          const [id, data, updated_at] = this._args;
          const k = key(table, id);
          store.set(k, { table, id, data, updated_at, deleted: 0 });
          return { success: true };
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
