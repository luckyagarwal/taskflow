import Dexie from "dexie";

export const db = new Dexie("taskflow");

// v3 — original local-only schema.
db.version(3).stores({
  tasks: "id, projectId, dueOffset, status, priority, done, createdAt",
  projects: "id, name",
  labels: "id, name",
  sections: "id, name"
});

// v4 — sync metadata. `updatedAt` drives last-write-wins, `_dirty` marks records
// not yet pushed to D1, and `_tombstones` records deletions so they propagate.
db.version(4).stores({
  tasks: "id, projectId, dueOffset, status, priority, done, createdAt, updatedAt, _dirty",
  projects: "id, name, updatedAt, _dirty",
  labels: "id, name, updatedAt, _dirty",
  sections: "id, name, updatedAt, _dirty",
  _tombstones: "[table+id], _dirty"
});

export const SYNCED_TABLES = ["tasks", "projects", "labels", "sections"];

// When true, writes originate from a remote merge: hooks must NOT re-stamp
// updatedAt / mark dirty (that would clobber the incoming value and loop).
let _applyingRemote = false;
export function setApplyingRemote(v) { _applyingRemote = v; }
export function isApplyingRemote() { return _applyingRemote; }

// Called (debounced) whenever a local write dirties a record, so the sync
// engine can schedule a push. Wired by sync.js to avoid a circular import.
let _onDirty = null;
export function setOnDirty(fn) { _onDirty = fn; }

const channel = typeof window !== 'undefined' ? new BroadcastChannel('taskflow-db-channel') : null;

let _onDbChange = null;
export function setOnDbChange(fn) { _onDbChange = fn; }

if (channel) {
  channel.onmessage = (event) => {
    if (event.data && event.data.type === 'db-changed' && _onDbChange) {
      _onDbChange();
    }
  };
}

let broadcastTimer = null;
export function broadcastDbChange() {
  if (!channel) return;
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    channel.postMessage({ type: 'db-changed' });
  }, 100);
}

SYNCED_TABLES.forEach((t) => {
  db[t].hook("creating", function (primKey, obj) {
    if (_applyingRemote) {
      if (obj._dirty === undefined) obj._dirty = 0;
      return;
    }
    if (obj.updatedAt === undefined) {
      obj.updatedAt = Date.now();
    } else {
      obj.updatedAt = Math.max(Date.now(), obj.updatedAt + 1);
    }
    obj._dirty = 1;
    if (_onDirty) _onDirty();
    broadcastDbChange();
  });

  db[t].hook("updating", function (mods, primKey, obj) {
    if (_applyingRemote) return; // keep incoming mods verbatim
    if (_onDirty) _onDirty();
    broadcastDbChange();
    const nextTs = Math.max(Date.now(), (obj.updatedAt || 0) + 1);
    return { updatedAt: nextTs, _dirty: 1 };
  });

  db[t].hook("deleting", function (primKey, obj) {
    if (_applyingRemote) return; // remote-driven delete: no tombstone needed
    // Write _tombstones OUTSIDE the delete's implicit (single-table) transaction.
    // ignoreTransaction escapes Dexie's transaction zone — a plain microtask
    // (Promise.resolve().then) would stay in scope and throw NotFoundError.
    const tomb = { table: t, id: primKey, updatedAt: Date.now(), _dirty: 1 };
    Dexie.ignoreTransaction(() => db._tombstones.put(tomb).catch(() => {}));
    if (_onDirty) _onDirty();
    broadcastDbChange();
  });
});
