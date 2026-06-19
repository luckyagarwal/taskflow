import "fake-indexeddb/auto";
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { makeFakeD1 } from "./fakeD1.mjs";
import { onRequestPost, onRequestDelete } from "../functions/api/sync.js";
import { db, setApplyingRemote } from "../src/db.js";
import { sync } from "../src/sync.js";

// ---- environment stubs (browser globals the engine relies on) ----
const _ls = new Map();
globalThis.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

let serverStore = new Map();
let simulateAuthError = false; // toggle to simulate Cloudflare Access block

globalThis.fetch = async (url, opts) => {
  if (simulateAuthError) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain" }
    });
  }
  const headers = { "Content-Type": "application/json" };
  const request = new Request("http://localhost" + url, { method: opts.method || "GET", headers, body: opts.body });
  const context = { request, env: { DB: makeFakeD1(serverStore) } };
  if (opts && opts.method === "DELETE") {
    return onRequestDelete(context);
  }
  return onRequestPost(context);
};

const flush = () => new Promise((r) => setTimeout(r, 0));

// Condition-based wait (deletion tombstones are written on a deferred microtask
// whose IndexedDB commit lands asynchronously).
async function waitFor(fn, { tries = 50, gap = 5 } = {}) {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, gap));
  }
  return false;
}

function seedServer(table, id, obj, updated_at, deleted = 0) {
  serverStore.set(`${table}|${id}`, {
    table, id,
    data: deleted ? null : JSON.stringify(obj),
    updated_at, deleted,
  });
}
const srv = (table, id) => serverStore.get(`${table}|${id}`);

before(async () => { await db.open(); });

beforeEach(async () => {
  setApplyingRemote(true);
  await Promise.all([db.tasks.clear(), db.projects.clear(), db.labels.clear(), db.sections.clear(), db._tombstones.clear()]);
  setApplyingRemote(false);
  serverStore = new Map();
  _ls.clear();
  simulateAuthError = false;
});

test("local write is stamped dirty then pushed to server", async () => {
  await db.tasks.put({ id: "t1", title: "A" });
  const before = await db.tasks.get("t1");
  assert.equal(before._dirty, 1, "write marked dirty");
  assert.ok(before.updatedAt > 0, "updatedAt stamped");

  await sync();

  const row = srv("tasks", "t1");
  assert.ok(row, "task reached server");
  assert.equal(row.deleted, 0);
  assert.equal(JSON.parse(row.data).title, "A");
  assert.equal((await db.tasks.get("t1"))._dirty, 0, "dirty cleared after push");
});

test("pulls a record created on another device", async () => {
  seedServer("tasks", "t2", { id: "t2", title: "FromPhone" }, Date.now());
  await sync();

  const local = await db.tasks.get("t2");
  assert.ok(local, "remote record merged locally");
  assert.equal(local.title, "FromPhone");
  assert.equal(local._dirty, 0, "merged record is not re-dirtied (no push loop)");
  assert.equal(await db.tasks.where("_dirty").equals(1).count(), 0);
});

test("last-write-wins: newer remote overwrites older local", async () => {
  await db.tasks.put({ id: "t3", title: "old" });
  const localTs = (await db.tasks.get("t3")).updatedAt;
  seedServer("tasks", "t3", { id: "t3", title: "new" }, localTs + 1000);

  await sync();

  assert.equal((await db.tasks.get("t3")).title, "new", "newer remote wins locally");
  assert.equal(JSON.parse(srv("tasks", "t3").data).title, "new", "server kept newer value");
});

test("last-write-wins: newer local overwrites older remote", async () => {
  seedServer("tasks", "t4", { id: "t4", title: "srv-old" }, 1000);
  await db.tasks.put({ id: "t4", title: "local-new" }); // updatedAt = now >> 1000

  await sync();

  assert.equal((await db.tasks.get("t4")).title, "local-new", "local stays winner");
  assert.equal(JSON.parse(srv("tasks", "t4").data).title, "local-new", "server took newer local value");
});

test("delete propagates as a tombstone", async () => {
  await db.tasks.put({ id: "t5", title: "doomed" });
  await sync(); // push the create first

  await db.tasks.delete("t5");
  const recorded = await waitFor(async () => (await db._tombstones.count()) === 1);
  assert.ok(recorded, "tombstone recorded locally");

  await sync();

  const row = srv("tasks", "t5");
  assert.equal(row.deleted, 1, "server marked tombstone");
  assert.equal(row.data, null, "tombstone clears data");
  assert.equal(await db._tombstones.where("_dirty").equals(1).count(), 0, "tombstone acked");
});

test("remote tombstone removes the local record", async () => {
  await db.tasks.put({ id: "t6", title: "here" });
  await sync();
  // another device deletes it later:
  seedServer("tasks", "t6", null, Date.now() + 1000, 1);

  await sync();

  assert.equal(await db.tasks.get("t6"), undefined, "local record removed by remote tombstone");
});

test("missing Access identity returns 401 and does not crash the engine", async () => {
  simulateAuthError = true;
  await db.tasks.put({ id: "t7", title: "offline-ish" });
  await sync(); // should swallow 401, leave record dirty for retry
  assert.equal((await db.tasks.get("t7"))._dirty, 1, "record stays dirty when unauthenticated");
  assert.equal(srv("tasks", "t7"), undefined, "nothing written server-side");
});

test("DELETE /api/sync wipes the database on server", async () => {
  seedServer("tasks", "t8", { id: "t8", title: "server-data" }, Date.now());
  assert.ok(srv("tasks", "t8"), "server task exists");

  const response = await fetch("/api/sync", { method: "DELETE" });
  assert.equal(response.status, 200, "wipe response is 200");
  const body = await response.json();
  assert.equal(body.success, true, "wipe returns success");

  assert.equal(srv("tasks", "t8"), undefined, "server task was wiped");
});
