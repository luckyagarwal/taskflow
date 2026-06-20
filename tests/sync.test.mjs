import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { onRequestGet as onDataGet } from "../functions/api/data.js";
import { onRequestPost as onSavePost, onRequestDelete as onSaveDelete } from "../functions/api/save.js";
import { onRequestGet as onEventsGet } from "../functions/api/events.js";
import { fetchAllData, saveChanges, setOnAuthStatusChange, pullChanges } from "../src/sync.js";
import * as repo from "../src/repo.js";
import { makeFakeD1 } from "./fakeD1.mjs";

let serverStore = new Map();
let simulateAuthError = false;

globalThis.fetch = async (url, opts = {}) => {
  if (simulateAuthError) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain" }
    });
  }

  const urlObj = new URL(url, "http://localhost");
  const path = urlObj.pathname;
  const method = opts.method || "GET";
  
  const headers = { "Content-Type": "application/json" };
  const request = new Request("http://localhost" + url, {
    method,
    headers,
    body: opts.body
  });
  
  const context = {
    request,
    env: { DB: makeFakeD1(serverStore) }
  };

  if (path === "/api/data" && method === "GET") {
    return onDataGet(context);
  }
  if (path === "/api/save") {
    if (method === "POST") {
      return onSavePost(context);
    }
    if (method === "DELETE") {
      return onSaveDelete(context);
    }
  }
  if (path === "/api/events" && method === "GET") {
    return onEventsGet(context);
  }

  return new Response("Not Found", { status: 404 });
};

// Mock BroadcastChannel for Node environment
globalThis.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
  }
  postMessage(data) {}
  close() {}
};

beforeEach(() => {
  serverStore = new Map();
  simulateAuthError = false;
  setOnAuthStatusChange(null);
});

test("fetch all data from empty server returns empty arrays", async () => {
  const data = await fetchAllData();
  assert.ok(data);
  assert.deepEqual(data.tasks, []);
  assert.deepEqual(data.projects, []);
  assert.deepEqual(data.labels, []);
  assert.deepEqual(data.sections, []);
});

test("saveChanges upserts records to server and fetchAllData retrieves them", async () => {
  const task = { id: "t1", title: "Test Task", priority: 1 };
  const project = { id: "p1", name: "Test Project" };

  const saved = await saveChanges({ tasks: [task], projects: [project] }, {});
  assert.ok(saved, "saveChanges succeeded");

  const data = await fetchAllData();
  assert.ok(data);
  assert.equal(data.tasks.length, 1);
  assert.equal(data.tasks[0].id, "t1");
  assert.equal(data.tasks[0].title, "Test Task");
  assert.equal(data.projects.length, 1);
  assert.equal(data.projects[0].id, "p1");
});

test("saveChanges deletes records from server", async () => {
  // First seed server
  const task = { id: "t1", title: "Test Task" };
  await saveChanges({ tasks: [task] }, {});
  
  // Verify it exists
  let data = await fetchAllData();
  assert.equal(data.tasks.length, 1);

  // Now delete it
  const deleted = await saveChanges({}, { tasks: ["t1"] });
  assert.ok(deleted, "delete succeeded");

  // Verify it's gone
  data = await fetchAllData();
  assert.equal(data.tasks.length, 0);
});

test("wipe database via DELETE /api/save clears server", async () => {
  // Seed server
  const task = { id: "t1", title: "Test Task" };
  await saveChanges({ tasks: [task] }, {});

  // Call delete API directly via fetch
  const response = await fetch("/api/save", { method: "DELETE" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.success);

  // Verify cleared
  const data = await fetchAllData();
  assert.equal(data.tasks.length, 0);
});

test("401 status triggers unauthorized flag change", async () => {
  let authStatus = null;
  setOnAuthStatusChange((status) => {
    authStatus = status;
  });

  simulateAuthError = true;
  const data = await fetchAllData();
  assert.equal(data, null);
  assert.equal(authStatus, false);
});

test("a reset on another device wipes this device's local store and outbox", async () => {
  // This device holds local data plus an un-synced outbox op — the exact state
  // that resurrects deleted data after a reset elsewhere.
  await repo.clearAll();
  await repo.putRecord("tasks", { id: "t_local", title: "Never synced" });
  assert.equal((await repo.getOutbox()).length, 1, "precondition: a pending op exists");

  // The server already reflects a reset performed on another device.
  await fetch("/api/save", { method: "DELETE" }); // generation → 1, rows wiped

  // First incremental pull after the reset.
  await pullChanges();

  assert.equal((await repo.loadAll()).tasks.length, 0, "local data cleared to match the reset");
  assert.equal((await repo.getOutbox()).length, 0, "un-synced outbox dropped so it cannot resurrect data");
  assert.equal(await repo.getGeneration(), 1, "adopted the new reset generation");

  await repo.clearAll();
});

test("SSE endpoint /api/events sends connected event", async () => {
  const res = await fetch("/api/events");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/event-stream");
  
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const text = new TextDecoder().decode(value);
  assert.ok(text.includes('"type":"connected"'));
  reader.cancel(); // close stream to stop the loop
});
