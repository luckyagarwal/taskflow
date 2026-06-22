import { test } from "node:test";
import assert from "node:assert/strict";
import { withRemindAt, computeRemindAt } from "../shared/compute.js";

const NOW = Date.UTC(2026, 5, 22, 6, 0, 0); // 2026-06-22 11:30 IST

test("dated task gets a computed remindAt", () => {
  const out = withRemindAt({ id: "t1", dueOffset: 0, time: "17:00" }, NOW);
  assert.equal(out.remindAt, computeRemindAt(0, "17:00", NOW));
});

test("date-only task gets the 09:00 remindAt", () => {
  const out = withRemindAt({ id: "t1", dueOffset: 1, time: null }, NOW);
  assert.equal(out.remindAt, computeRemindAt(1, null, NOW));
});

test("task with no date gets remindAt null", () => {
  const out = withRemindAt({ id: "t1", dueOffset: null, time: null }, NOW);
  assert.equal(out.remindAt, null);
});

test("clearing the date sets remindAt back to null", () => {
  const dated = withRemindAt({ id: "t1", dueOffset: 0, time: "17:00" }, NOW);
  const cleared = withRemindAt({ ...dated, dueOffset: null, time: null }, NOW);
  assert.equal(cleared.remindAt, null);
});

test("changing remindAt clears a previously-sent flag", () => {
  const sent = { id: "t1", dueOffset: 0, time: "17:00", remindAt: computeRemindAt(0, "17:00", NOW), reminderSent: true };
  const moved = withRemindAt({ ...sent, dueOffset: 2 }, NOW);
  assert.equal(moved.reminderSent, false);
});

test("an unrelated edit keeps reminderSent intact", () => {
  const remindAt = computeRemindAt(0, "17:00", NOW);
  const sent = { id: "t1", title: "old", dueOffset: 0, time: "17:00", remindAt, reminderSent: true };
  const renamed = withRemindAt({ ...sent, title: "new" }, NOW);
  assert.equal(renamed.reminderSent, true);
  assert.equal(renamed.remindAt, remindAt);
});

test("a fresh dated task is not marked already-sent", () => {
  const out = withRemindAt({ id: "t1", dueOffset: 0, time: "17:00" }, NOW);
  assert.equal(out.reminderSent, false);
});
