// src/sync.js — Background sync engine (local-first, Google-Tasks style).
//
// The local Dexie store (repo.js) is the source of truth. This engine:
//   • flushOutbox() — drains pending local mutations to the server, serialized
//     (one in-flight at a time) with per-record coalescing and exponential
//     backoff. Failed ops stay in the outbox and retry — edits are never lost.
//   • pullChanges() — incremental pull of only what changed since the stored
//     sync token (`?since=`), merged via last-write-wins. Triggered on load, on
//     a server "tickle" (SSE / BroadcastChannel), on focus/visibility, on poll,
//     and on reconnect — this is what makes a change on one device appear on the
//     other within ~2s.
import * as repo from './repo.js';

const DATA_API = '/api/data';
const SAVE_API = '/api/save';
const POLL_INTERVAL_MS = 15000;

let isAuthorized = true;
let onAuthStatusChange = null;
let pollTimer = null;
let onDataReload = null;

const channel = typeof window !== 'undefined' ? new BroadcastChannel('taskflow-api-channel') : null;

if (channel) {
  channel.onmessage = (event) => {
    if (event.data && event.data.type === 'api-changed') pullChanges();
  };
}

function broadcastChange() {
  if (channel) channel.postMessage({ type: 'api-changed' });
}

export function setOnAuthStatusChange(fn) {
  onAuthStatusChange = fn;
}

export function getIsAuthorized() {
  return isAuthorized;
}

function setAuthorized(value) {
  if (isAuthorized !== value) {
    isAuthorized = value;
    if (onAuthStatusChange) onAuthStatusChange(value);
  }
}

function isLocalHostname() {
  if (typeof window === 'undefined') return false;
  const hn = window.location.hostname;
  return hn === 'localhost' ||
         hn === '127.0.0.1' ||
         hn === '0.0.0.0' ||
         hn === '[::1]' ||
         hn === '[::]' ||
         hn.startsWith('192.168.') ||
         hn.startsWith('10.') ||
         /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hn) ||
         hn.endsWith('.local') ||
         hn.endsWith('.test') ||
         hn.endsWith('.localhost') ||
         hn.includes('github.dev') ||
         hn.includes('gitpod.io') ||
         hn.includes('webcontainer.io') ||
         hn.includes('ngrok-free.app') ||
         hn.includes('ngrok.io') ||
         hn.includes('trycloudflare.com');
}

export function getSyncHeaders(contentType = 'application/json') {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (isLocalHostname()) {
    headers['Cf-Access-Authenticated-User-Email'] = 'dev@example.com';
  }
  return headers;
}

// ── Network reads ───────────────────────────────────────────────────────

/** Fetch records from the server. `since=null` → full snapshot; else delta. */
async function fetchSince(since) {
  try {
    const url = since == null ? DATA_API : `${DATA_API}?since=${since}`;
    const res = await fetch(url, { method: 'GET', headers: getSyncHeaders(null), cache: 'no-store' });

    if (res.status === 401 || res.redirected) {
      setAuthorized(false);
      return null;
    }
    if (!res.ok) throw new Error('Fetch failed: HTTP ' + res.status);

    setAuthorized(true);
    return await res.json();
  } catch (err) {
    console.error('fetch failed', err);
    return null;
  }
}

/** Backwards-compatible full fetch (used by legacy callers/tests). */
export async function fetchAllData() {
  return fetchSince(null);
}

// ── Network writes ──────────────────────────────────────────────────────

export async function saveChanges(upserts = {}, deletes = {}) {
  try {
    const generation = await repo.getGeneration();
    const res = await fetch(SAVE_API, {
      method: 'POST',
      headers: getSyncHeaders('application/json'),
      body: JSON.stringify({ upserts, deletes, generation }),
      cache: 'no-store',
    });

    if (res.status === 401 || res.redirected) {
      setAuthorized(false);
      return false;
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Save failed (HTTP ${res.status}): ${errBody.details || errBody.error || 'Unknown error'}`);
    }

    setAuthorized(true);
    const resBody = await res.json().catch(() => ({}));
    if (resBody && resBody.rejected) {
      // These writes were minted before a reset on another device. Returning
      // true lets the outbox drop them (no infinite retry); pulling now adopts
      // the wipe so the stale data also disappears from this device's UI.
      pullChanges();
      return true;
    }
    broadcastChange();
    return true;
  } catch (err) {
    console.error('save failed', err);
    return false;
  }
}

// ── Outbox flusher (serialized + coalesced + backoff) ─────────────────────

let flushing = false;
let flushAgain = false;
let backoffMs = 0;
let backoffTimer = null;

/** Public kick — safe to call as often as you like; coalesces into one flush. */
export function scheduleFlush() {
  flushOutbox();
}

export async function flushOutbox() {
  if (flushing) { flushAgain = true; return; } // serialize: never two in flight
  flushing = true;
  try {
    const entries = await repo.getOutbox();
    if (entries.length) {
      const upserts = {};
      const deletes = {};
      for (const e of entries) {
        if (e.op === 'upsert') (upserts[e.table] ||= []).push(e.payload);
        else (deletes[e.table] ||= []).push({ id: e.recordId, updatedAt: e.clientTs });
      }
      const ok = await saveChanges(upserts, deletes);
      if (ok) {
        await repo.clearOutboxEntries(entries);
        backoffMs = 0;
        clearTimeout(backoffTimer);
      } else {
        scheduleBackoff();
      }
    }
  } catch (err) {
    console.error('flush failed', err);
    scheduleBackoff();
  } finally {
    flushing = false;
    if (flushAgain) { flushAgain = false; flushOutbox(); }
  }
}

function scheduleBackoff() {
  clearTimeout(backoffTimer);
  backoffMs = Math.min(backoffMs ? backoffMs * 2 : 1000, 30000);
  backoffTimer = setTimeout(flushOutbox, backoffMs);
}

// ── Incremental + full pulls ──────────────────────────────────────────────

async function emitLocal() {
  if (onDataReload) onDataReload(await repo.loadAll());
}

/** Pull only what changed since our sync token, merge (LWW), refresh the UI. */
export async function pullChanges() {
  const since = await repo.getToken();
  const data = await fetchSince(since);
  if (!data) return null;

  // A higher server generation means a reset happened on another device. The
  // incremental delta can't express "drop everything you have" — and our outbox
  // would replay stale rows back — so we wipe locally and re-adopt the snapshot.
  const localGen = await repo.getGeneration();
  if (typeof data.generation === 'number' && data.generation > localGen) {
    return adoptReset(data.generation);
  }

  await repo.applyServerRecords(data);
  if (typeof data.serverMax === 'number' && data.serverMax > since) {
    await repo.setToken(data.serverMax);
  }
  await emitLocal();
  return data;
}

/** Discard all local state (incl. the outbox) and adopt the post-reset snapshot. */
async function adoptReset(generation) {
  const snapshot = await fetchSince(null);
  if (!snapshot) return null;
  await repo.clearAll(); // drops local rows, the outbox, the token and old generation
  await repo.replaceFromSnapshot(snapshot);
  if (typeof snapshot.serverMax === 'number') await repo.setToken(snapshot.serverMax);
  await repo.setGeneration(generation);
  await emitLocal();
  return snapshot;
}

/** Full reconcile: replace local with the server snapshot (server authoritative). */
export async function fullSync() {
  const data = await fetchSince(null);
  if (!data) return null;
  await repo.replaceFromSnapshot(data);
  if (typeof data.serverMax === 'number') await repo.setToken(data.serverMax);
  if (typeof data.generation === 'number') await repo.setGeneration(data.generation);
  await emitLocal();
  return data;
}

// ── Server "tickle" channel (SSE) + polling + lifecycle ───────────────────

let eventSource = null;

function setupEventSource() {
  if (typeof EventSource === 'undefined') return;
  if (eventSource) { try { eventSource.close(); } catch { /* noop */ } }

  eventSource = new EventSource('/api/events');
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.type === 'api-changed') pullChanges();
    } catch (err) {
      console.error('SSE parse error', err);
    }
  };
  eventSource.onerror = (err) => {
    console.error('SSE connection error', err);
  };
}

function runPollingLoop() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      pullChanges();
    }
    runPollingLoop();
  }, POLL_INTERVAL_MS);
}

function handleVisibilityOrFocus() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    // Pull first so a reset elsewhere is adopted (and a stale outbox dropped)
    // before we try to flush; then drain anything queued while hidden/offline.
    pullChanges().then(flushOutbox);
    runPollingLoop();
    if (eventSource && eventSource.readyState === EventSource.CLOSED) setupEventSource();
  }
}

export async function startOnlineSync(onDataReloadCb) {
  onDataReload = onDataReloadCb;

  // Initial incremental pull (first run: token=0 → pulls everything).
  await pullChanges();
  // Drain any mutations left over from a previous offline session.
  flushOutbox();

  runPollingLoop();

  if (typeof window !== 'undefined') {
    setupEventSource();
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('online', () => { pullChanges().then(flushOutbox); });
  }
}

// Wire the repo's write-kick to our flusher (set once at module load).
repo.setFlushKick(scheduleFlush);
