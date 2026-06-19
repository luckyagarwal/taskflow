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

let syncDisabled = false;
let pollTimer = null;

let isAuthorized = true;
let onAuthStatusChange = null;

export function setOnAuthStatusChange(fn) {
  onAuthStatusChange = fn;
}

export function getIsAuthorized() {
  return isAuthorized;
}

export function disableSync() {
  syncDisabled = true;
  clearTimeout(debounceTimer);
  clearTimeout(pollTimer);
}

function isLocalHostname() {
  if (typeof window === 'undefined') return false;
  const hn = window.location.hostname;
  return hn === 'localhost' || 
         hn === '127.0.0.1' || 
         hn === '[::1]' ||
         hn.startsWith('192.168.') || 
         hn.startsWith('10.') || 
         /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hn) ||
         hn.endsWith('.local');
}

export function getSyncHeaders(contentType = 'application/json') {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  
  if (isLocalHostname()) {
    headers['Cf-Access-Authenticated-User-Email'] = 'dev@example.com';
  }
  return headers;
}

export async function sync() {
  if (syncDisabled) return;
  if (inFlight) { pending = true; return; }
  inFlight = true;
  try {
    const since = getSince();
    const changes = await collectDirty();
    const res = await fetch(API, {
      method: "POST",
      headers: getSyncHeaders('application/json'),
      body: JSON.stringify({ since, changes }),
      cache: 'no-store'
    });
    if (syncDisabled) return;

    // Detect Cloudflare Access redirect to login page (which is HTML, not JSON, or returns 401/redirected)
    const contentType = res.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    
    let unauthorized = res.status === 401 || res.redirected;
    if (isHtml && !isLocalHostname()) {
      unauthorized = true;
    }

    if (unauthorized) {
      if (isAuthorized) {
        isAuthorized = false;
        if (onAuthStatusChange) onAuthStatusChange(false);
      }
      return;
    }

    if (!res.ok) throw new Error("sync HTTP " + res.status);

    if (!isAuthorized) {
      isAuthorized = true;
      if (onAuthStatusChange) onAuthStatusChange(true);
    }

    const data = await res.json();
    if (syncDisabled) return;
    await clearPushed(changes);
    if (syncDisabled) return;
    const merged = await applyRemote(data.changes);
    if (syncDisabled) return;
    if (typeof data.now === "number") setSince(data.now);
    if (merged && onMerge) await onMerge();
  } catch (err) {
    console.error("sync failed", err);
  } finally {
    inFlight = false;
    if (pending && !syncDisabled) { pending = false; sync(); }
  }
}

export function scheduleSync(delay = DEBOUNCE_MS) {
  if (syncDisabled) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => sync(), delay);
}

function getPollInterval() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return 30000; // 30s in background
  }
  return 5000; // 5s in foreground
}

function runPollingLoop() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    if (!syncDisabled) {
      await sync();
    }
    runPollingLoop();
  }, getPollInterval());
}

function handleVisibilityOrFocus() {
  if (!syncDisabled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    sync();
    runPollingLoop();
  }
}

// onMergeCb: re-reads Dexie into React state after remote changes land.
export function startSync(onMergeCb) {
  onMerge = onMergeCb || null;
  setOnDirty(() => {
    if (!syncDisabled) scheduleSync();
  });
  
  // Initial sync
  sync();
  
  // Start polling
  runPollingLoop();

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      if (!syncDisabled) sync();
    });
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
  }
}
