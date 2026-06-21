import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTask, offsetFromDate } from "../src/data.js";

const projects = [{ id: "p_launch", name: "Work" }, { id: "p_home", name: "Home" }];
const labels = [{ id: "l_email", name: "email" }, { id: "l_deep", name: "deep" }];
const P = (s) => parseTask(s, projects, labels);

test("plain text → content only", () => {
  const r = P("Buy milk");
  assert.equal(r.content, "Buy milk");
  assert.equal(r.priority, 4);
  assert.equal(r.dueOffset, null);
});

test("priority token p1", () => {
  const r = P("Send deck p1");
  assert.equal(r.content, "Send deck");
  assert.equal(r.priority, 1);
});

test("project #Work + label @deep + p2", () => {
  const r = P("Review copy #Work @deep p2");
  assert.equal(r.content, "Review copy");
  assert.equal(r.projectId, "p_launch");
  assert.deepEqual(r.labels, ["l_deep"]);
  assert.equal(r.priority, 2);
});

test("relative date + time", () => {
  const r = P("Call mom tomorrow at 5pm");
  assert.equal(r.content, "Call mom");
  assert.equal(r.dueOffset, 1);
  assert.equal(r.time, "17:00");
});

test("recurrence every month", () => {
  const r = P("Pay bill every month");
  assert.deepEqual(r.recurring, { type: "month" });
});

test("in N days", () => {
  const r = P("Read book in 3 days");
  assert.equal(r.dueOffset, 3);
});

test("absolute date + trailing time both parse (ordering bug)", () => {
  const r = P("Meeting Dec 3 at 2pm");
  assert.equal(r.content, "Meeting");
  assert.equal(r.time, "14:00");
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 11, 3);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 11, 3);
  assert.equal(r.dueOffset, offsetFromDate(target));
});
