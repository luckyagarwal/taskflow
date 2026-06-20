// Minimal in-memory D1 stand-in that understands exactly the SQL shapes
// used by the new online-only data, save, and events endpoints.

export function makeFakeD1(store = new Map()) {
  const key = (table, id) => `${table}|${id}`;

  function prepare(sql) {
    const stmt = {
      _args: [],
      bind(...args) { this._args = args; return this; },
      async all() {
        // meta key/value lookup: SELECT value FROM meta WHERE key = ?
        if (/FROM meta\b/.test(sql)) {
          const v = store.get(key('meta', this._args[0]));
          return { results: v ? [{ value: v.value }] : [] };
        }

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

        const tableMatch = sql.match(/FROM (\w+)/);
        if (!tableMatch) return { results: [] };
        const table = tableMatch[1];

        // Incremental: WHERE updated_at > ?  → changed rows incl. tombstones.
        // Full snapshot: WHERE deleted = 0   → live rows only.
        const incremental = sql.includes("updated_at > ?");
        const since = incremental ? this._args[0] : null;

        const results = [];
        for (const v of store.values()) {
          if (v.table !== table) continue;
          if (incremental ? v.updated_at > since : !v.deleted) {
            results.push({ id: v.id, data: v.data, updated_at: v.updated_at, deleted: v.deleted });
          }
        }
        return { results };
      },
      async run() {
        if (sql.includes("DELETE FROM")) {
          const tableMatch = sql.match(/DELETE FROM (\w+)/);
          if (!tableMatch) return { success: false };
          const table = tableMatch[1];

          // Tombstone purge: DELETE … WHERE deleted = 1 AND updated_at < ?
          if (sql.includes("WHERE deleted = 1")) {
            const cutoff = this._args[0];
            for (const [k, v] of store.entries()) {
              if (v.table === table && v.deleted && v.updated_at < cutoff) store.delete(k);
            }
            return { success: true };
          }

          // Full-table wipe (DELETE /api/save reset).
          for (const [k, v] of store.entries()) {
            if (v.table === table) store.delete(k);
          }
          return { success: true };
        }

        // Reset: UPDATE <t> SET data='', updated_at=?, deleted=1 WHERE deleted=0
        if (/^\s*UPDATE/.test(sql)) {
          const tableMatch = sql.match(/UPDATE (\w+)/);
          if (!tableMatch) return { success: false };
          const table = tableMatch[1];
          const ts = this._args[0];
          for (const [k, v] of store.entries()) {
            if (v.table === table && !v.deleted) {
              store.set(k, { ...v, data: '', updated_at: ts, deleted: 1 });
            }
          }
          return { success: true };
        }

        // meta upsert: INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT…
        if (sql.includes("INSERT INTO meta")) {
          const [k, value] = this._args;
          store.set(key('meta', k), { table: 'meta', id: k, key: k, value });
          return { success: true };
        }

        if (sql.includes("INSERT INTO")) {
          const tableMatch = sql.match(/INSERT INTO (\w+)/);
          if (!tableMatch) return { success: false };
          const table = tableMatch[1];

          // Tombstone delete: VALUES (?, '', ?, 1) binds [id, updated_at].
          // Upsert:           VALUES (?, ?, ?, 0)  binds [id, data, updated_at].
          const isTombstone = sql.includes("VALUES (?, '', ?, 1)");
          const id = this._args[0];
          const updated_at = isTombstone ? this._args[1] : this._args[2];
          const data = isTombstone ? '' : this._args[1];
          const deleted = isTombstone ? 1 : 0;

          const k = key(table, id);
          const existing = store.get(k);
          // LWW guard mirrors the SQL `WHERE excluded.updated_at >= updated_at`.
          if (existing && updated_at < existing.updated_at) return { success: true };

          store.set(k, { table, id, data, updated_at, deleted });
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
