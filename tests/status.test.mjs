import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_ORDER, STATUS_LABELS, statusPatch, columnOf, groupTasksByStatus } from "../src/status.js";

const mk = (o = {}) => ({ id: "t", projectId: "p1", status: "planned", done: false, doneOffset: null, ...o });

test("STATUS_ORDER and labels", () => {
  assert.deepEqual(STATUS_ORDER, ["planned", "inprogress", "blocked", "waiting", "done"]);
  assert.equal(STATUS_LABELS.inprogress, "In Progress");
});

test("statusPatch: done vs non-done", () => {
  assert.deepEqual(statusPatch("done"), { status: "done", done: true, doneOffset: 0 });
  assert.deepEqual(statusPatch("inprogress"), { status: "inprogress", done: false, doneOffset: null });
});

test("columnOf: done overrides; missing status → planned", () => {
  assert.equal(columnOf(mk({ done: true, status: "blocked" })), "done");
  assert.equal(columnOf(mk({ status: undefined })), "planned");
  assert.equal(columnOf(mk({ status: "blocked" })), "blocked");
});

test("groupTasksByStatus: buckets, recent-done window, project filter", () => {
  const tasks = [
    mk({ id: "a", status: "planned" }),
    mk({ id: "b", status: "inprogress" }),
    mk({ id: "c", done: true, status: "blocked", doneOffset: -3 }),
    mk({ id: "d", done: true, status: "done", doneOffset: -30 }),
    mk({ id: "e", status: "waiting", projectId: "p2" }),
  ];
  const cols = groupTasksByStatus(tasks, { recentDoneDays: 7 });
  assert.deepEqual(cols.planned.map((t) => t.id), ["a"]);
  assert.deepEqual(cols.inprogress.map((t) => t.id), ["b"]);
  assert.deepEqual(cols.done.map((t) => t.id), ["c"]);
  assert.deepEqual(cols.waiting.map((t) => t.id), ["e"]);

  const filtered = groupTasksByStatus(tasks, { projectId: "p1", recentDoneDays: 7 });
  assert.deepEqual(filtered.waiting.map((t) => t.id), []);
});
