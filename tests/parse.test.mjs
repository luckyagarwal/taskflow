import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTask, offsetFromDate, dateFromOffset } from "../src/data.js";

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

test("day-first absolute date: 15 Jan", () => {
  const r = P("Submit report 15 Jan");
  assert.equal(r.content, "Submit report");
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 0, 15);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 0, 15);
  assert.equal(r.dueOffset, offsetFromDate(target));
});

test("day-first full month name: 1 March", () => {
  const r = P("Pay rent 1 March");
  assert.equal(r.content, "Pay rent");
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 2, 1);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 2, 1);
  assert.equal(r.dueOffset, offsetFromDate(target));
});

test("explicit year is honoured: Jan 15 2030", () => {
  const r = P("Launch Jan 15 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});

test("day-first with explicit year: 15 Jan 2030", () => {
  const r = P("Launch 15 Jan 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});

test("day-first with comma year: 15 Jan, 2030", () => {
  const r = P("Launch 15 Jan, 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});

test("month-first with comma year stays correct: Jan 15, 2030", () => {
  const r = P("Launch Jan 15, 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});

const DOW = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

test("bare weekday 'on thursday' + time (reported bug)", () => {
  const r = P("help me understand this on thursday 5pm");
  assert.equal(r.content, "help me understand this");
  assert.equal(r.time, "17:00");
  assert.notEqual(r.dueOffset, null);
  assert.equal(dateFromOffset(r.dueOffset).getDay(), DOW.thursday);
});

test("bare weekday without 'on'", () => {
  const r = P("Call mom friday");
  assert.equal(r.content, "Call mom");
  assert.equal(dateFromOffset(r.dueOffset).getDay(), DOW.friday);
});

test("bare weekday resolves to an upcoming date (0..6 days out)", () => {
  const r = P("Sync tuesday");
  assert.ok(r.dueOffset >= 0 && r.dueOffset <= 6, `expected 0..6, got ${r.dueOffset}`);
});

test("'next thursday' is unaffected by the bare-weekday pattern", () => {
  // The bare pattern must sit AFTER "next <weekday>" so this still matches first.
  const bare = P("x thursday").dueOffset;
  const next = P("x next thursday").dueOffset;
  assert.ok(next >= 1 && next <= 7, `next out of range: ${next}`);
  // They diverge only when today is Thursday: bare→0 (today), next→7.
  if (bare === 0) assert.equal(next, 7);
  else assert.equal(next, bare);
});
