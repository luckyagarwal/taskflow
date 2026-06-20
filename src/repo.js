// src/repo.js — Repository layer over the local Dexie store.
//
// All UI mutations go through here: they write to IndexedDB (durable, instant)
// and append a pending op to the outbox, then kick the sync engine to flush.
// Server data is merged back in via last-write-wins, with in-flight local edits
// always protected (a record with a pending outbox op is never overwritten).
import { db, RECORD_TABLES } from './db.js';

// The sync engine registers its flush trigger here to avoid a circular import.
let flushKick = null;
export function setFlushKick(fn) {
  flushKick = fn;
}

const keyFor = (table, id) => `${table}:${id}`;

/** Read all non-deleted records from the local store (instant; works offline). */
export async function loadAll() {
  const [tasks, projects, labels, sections] = await Promise.all(
    RECORD_TABLES.map((t) => db[t].filter((r) => !r.deleted).toArray())
  );
  return { tasks, projects, labels, sections };
}

/** Write a record locally + queue an upsert. Stamps the client timestamp (LWW). */
export async function putRecord(table, record) {
  const updatedAt = Date.now();
  const rec = { ...record, updatedAt, deleted: 0 };
  await db.transaction('rw', db[table], db.outbox, async () => {
    await db[table].put(rec);
    await db.outbox.put({
      key: keyFor(table, record.id),
      table,
      recordId: record.id,
      op: 'upsert',
      payload: rec,
      clientTs: updatedAt,
      tries: 0,
    });
  });
  if (flushKick) flushKick();
  return rec;
}

/** Soft-delete a record locally + queue a delete (tombstone propagates on sync). */
export async function removeRecord(table, id) {
  const updatedAt = Date.now();
  await db.transaction('rw', db[table], db.outbox, async () => {
    const existing = await db[table].get(id);
    if (existing) await db[table].put({ ...existing, deleted: 1, updatedAt });
    await db.outbox.put({
      key: keyFor(table, id),
      table,
      recordId: id,
      op: 'delete',
      payload: null,
      clientTs: updatedAt,
      tries: 0,
    });
  });
  if (flushKick) flushKick();
}

/**
 * Façade matching the old `queueSave(upserts, deletes)` signature so the ~30
 * existing call sites in store.jsx need no rewrite — they now durably persist
 * locally and sync in the background instead of firing un-awaited POSTs.
 */
export async function enqueue(upserts = {}, deletes = {}) {
  for (const t of RECORD_TABLES) {
    for (const rec of upserts[t] || []) {
      if (rec && rec.id) await putRecord(t, rec);
    }
    for (const id of deletes[t] || []) {
      if (id) await removeRecord(t, id);
    }
  }
}

/**
 * Merge an incremental server delta into the local store.
 * Skips any record with a pending outbox op (local edit wins) and applies
 * last-write-wins by `updatedAt` so a stale server row can't clobber newer local.
 */
export async function applyServerRecords(data) {
  for (const t of RECORD_TABLES) {
    const recs = data[t] || [];
    if (!recs.length) continue;
    await db.transaction('rw', db[t], db.outbox, async () => {
      for (const sr of recs) {
        const pending = await db.outbox.get(keyFor(t, sr.id));
        if (pending) continue; // in-flight local edit takes precedence
        const local = await db[t].get(sr.id);
        if (local && (local.updatedAt || 0) >= (sr.updatedAt || 0)) continue; // LWW
        await db[t].put({ ...sr, deleted: sr.deleted ? 1 : 0 });
      }
    });
  }
}

/**
 * Replace local contents with a full server snapshot (force-sync / import).
 * Records with pending local ops are preserved so unsent edits aren't lost.
 */
export async function replaceFromSnapshot(data) {
  for (const t of RECORD_TABLES) {
    await db.transaction('rw', db[t], db.outbox, async () => {
      const pendingIds = new Set(
        (await db.outbox.where('table').equals(t).toArray()).map((o) => o.recordId)
      );
      for (const r of await db[t].toArray()) {
        if (!pendingIds.has(r.id)) await db[t].delete(r.id);
      }
      for (const sr of data[t] || []) {
        if (pendingIds.has(sr.id)) continue;
        await db[t].put({ ...sr, deleted: sr.deleted ? 1 : 0 });
      }
    });
  }
}

// ── Outbox + sync-token helpers (used by the sync engine) ──────────────
export async function getOutbox() {
  return db.outbox.toArray();
}

/** Remove confirmed ops, but only if not superseded by a newer edit mid-flush. */
export async function clearOutboxEntries(entries) {
  await db.transaction('rw', db.outbox, async () => {
    for (const e of entries) {
      const cur = await db.outbox.get(e.key);
      if (cur && cur.clientTs === e.clientTs) await db.outbox.delete(e.key);
    }
  });
}

export async function getToken() {
  const m = await db.meta.get('syncToken');
  return m ? m.value : 0;
}

export async function setToken(value) {
  await db.meta.put({ key: 'syncToken', value });
}

export async function clearAll() {
  await Promise.all([
    ...RECORD_TABLES.map((t) => db[t].clear()),
    db.outbox.clear(),
    db.meta.clear(),
  ]);
}
