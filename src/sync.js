// Local-first sync engine. Pushes dirty Dexie records to /api/sync and merges
// back anything newer from other devices. Conflict resolution is last-write-wins
// by `updatedAt`; deletions travel as tombstones.

import { db, SYNCED_TABLES as TABLES, setApplyingRemote, setOnDirty } from "./db.js";

const API = "/api/sync";
const SINCE_KEY = "taskflow-sync-since";
const DEBOUNCE_MS = 2000;
const INTERVAL_MS = 30000;

let inFlight = false;
let pending = false;
let debounceTimer = null;
let onMerge = null; // refresh React state after a merge changes Dexie

function getSince() { return Number(localStorage.getItem(SINCE_KEY)) || 0; }
function setSince(v) { localStorage.setItem(SINCE_KEY, String(v)); }

function stripMeta(record) {
  const o = { ...record };
  delete o._dirty;
  return o;
}

// Gather every record/ tombstone not yet acknowledged by the server.
async function collectDirty() {
  const changes = {};
  for (const t of TABLES) {
    const rows = await db[t].where("_dirty").equals(1).toArray();
    changes[t] = rows.map((r) => ({
      id: r.id,
      data: stripMeta(r),
      updatedAt: r.updatedAt,
      deleted: 0,
    }));
  }
  const tombs = await db._tombstones.where("_dirty").equals(1).toArray();
  for (const tomb of tombs) {
    if (!changes[tomb.table]) changes[tomb.table] = [];
    changes[tomb.table].push({ id: tomb.id, data: null, updatedAt: tomb.updatedAt, deleted: 1 });
  }
  return changes;
}

// Clear dirty flags for exactly what we pushed — but only if the record hasn't
// been edited again since (updatedAt unchanged), so concurrent edits still push.
async function clearPushed(changes) {
  setApplyingRemote(true);
  try {
    for (const t of TABLES) {
      for (const c of changes[t] || []) {
        if (c.deleted) {
          await db._tombstones.delete([t, c.id]).catch(() => {});
        } else {
          await db[t]
            .where("id").equals(c.id)
            .and((r) => r.updatedAt === c.updatedAt && r._dirty === 1)
            .modify({ _dirty: 0 })
            .catch(() => {});
        }
      }
    }
  } finally {
    setApplyingRemote(false);
  }
}

// Merge server rows into Dexie. Incoming wins only if strictly newer locally.
async function applyRemote(remote) {
  if (!remote) return false;
  let changed = false;
  setApplyingRemote(true);
  try {
    for (const t of TABLES) {
      for (const rec of remote[t] || []) {
        const local = await db[t].get(rec.id);
        if (rec.deleted) {
          if (local) { await db[t].delete(rec.id); changed = true; }
          continue;
        }
        if (!local || rec.updated_at > (local.updatedAt || 0)) {
          await db[t].put({ ...rec.data, id: rec.id, updatedAt: rec.updated_at, _dirty: 0 });
          changed = true;
        }
      }
    }
  } finally {
    setApplyingRemote(false);
  }
  return changed;
}

export async function sync() {
  if (inFlight) { pending = true; return; }
  inFlight = true;
  try {
    const since = getSince();
    const changes = await collectDirty();
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ since, changes }),
    });
    if (res.status === 401) return;       // not signed in via Cloudflare Access
    if (!res.ok) throw new Error("sync HTTP " + res.status);

    const data = await res.json();
    await clearPushed(changes);
    const merged = await applyRemote(data.changes);
    if (typeof data.now === "number") setSince(data.now);
    if (merged && onMerge) await onMerge();
  } catch (err) {
    console.error("sync failed", err);
  } finally {
    inFlight = false;
    if (pending) { pending = false; sync(); }
  }
}

export function scheduleSync(delay = DEBOUNCE_MS) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => sync(), delay);
}

// onMergeCb: re-reads Dexie into React state after remote changes land.
export function startSync(onMergeCb) {
  onMerge = onMergeCb || null;
  setOnDirty(() => scheduleSync());
  sync();
  setInterval(() => sync(), INTERVAL_MS);
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => sync());
  }
}
