import { test } from "node:test";
import assert from "node:assert/strict";
import { compileQuery } from "../src/query.js";

const ctx = {
  labels: [{ id: "l_email", name: "email" }, { id: "l_deep", name: "deep work" }],
  projects: [{ id: "p_work", name: "Work" }, { id: "p_home", name: "Home" }],
};
const mk = (o = {}) => ({ priority: 4, dueOffset: null, status: "planned", labels: [], projectId: "inbox", done: false, ...o });
const run = (q, task) => { const c = compileQuery(q, ctx); assert.ok(c.ok, c.error); return c.predicate(task); };

test("empty query matches all", () => {
  const c = compileQuery("", ctx);
  assert.equal(c.empty, true);
  assert.equal(c.predicate(mk()), true);
});

test("priority term", () => {
  assert.equal(run("p1", mk({ priority: 1 })), true);
  assert.equal(run("p1", mk({ priority: 2 })), false);
});

test("due buckets", () => {
  assert.equal(run("overdue", mk({ dueOffset: -2 })), true);
  assert.equal(run("overdue", mk({ dueOffset: 0 })), false);
  assert.equal(run("today", mk({ dueOffset: 0 })), true);
  assert.equal(run("upcoming", mk({ dueOffset: 3 })), true);
  assert.equal(run("nodate", mk({ dueOffset: null })), true);
  assert.equal(run("nodate", mk({ dueOffset: 1 })), false);
});

test("done sets usesDone and matches completed", () => {
  const c = compileQuery("done", ctx);
  assert.equal(c.usesDone, true);
  assert.equal(c.predicate(mk({ done: true })), true);
});

test("status and recurring", () => {
  assert.equal(run("blocked", mk({ status: "blocked" })), true);
  assert.equal(run("recurring", mk({ recurring: { type: "day" } })), true);
});

test("@label resolves spaces-removed; unknown matches nothing", () => {
  assert.equal(run("@email", mk({ labels: ["l_email"] })), true);
  assert.equal(run("@deepwork", mk({ labels: ["l_deep"] })), true);
  assert.equal(run("@nope", mk({ labels: ["l_email"] })), false);
  assert.equal(compileQuery("@nope", ctx).ok, true);
});

test("#project and inbox", () => {
  assert.equal(run("#work", mk({ projectId: "p_work" })), true);
  assert.equal(run("#inbox", mk({ projectId: "inbox" })), true);
  assert.equal(run("inbox", mk({ projectId: "inbox" })), true);
});

test("operators: and / or / not / parens / implicit-and", () => {
  assert.equal(run("p1 & overdue", mk({ priority: 1, dueOffset: -1 })), true);
  assert.equal(run("p1 & overdue", mk({ priority: 1, dueOffset: 2 })), false);
  assert.equal(run("p1 | p2", mk({ priority: 2 })), true);
  assert.equal(run("!done", mk({ done: false })), true);
  assert.equal(run("!done", mk({ done: true })), false);
  assert.equal(run("(p1 | p2) & today", mk({ priority: 2, dueOffset: 0 })), true);
  assert.equal(run("p1 overdue", mk({ priority: 1, dueOffset: -1 })), true);
});

test("errors", () => {
  assert.equal(compileQuery("bogusterm", ctx).ok, false);
  assert.equal(compileQuery("(p1 | p2", ctx).ok, false);
});
