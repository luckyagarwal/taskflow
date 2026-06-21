import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSubtaskPrompt, parseSubtasks } from "../functions/api/_ai.js";

test("buildSubtaskPrompt: includes title, omits empty note", () => {
  const p = buildSubtaskPrompt("Plan birthday party", "");
  assert.match(p, /Plan birthday party/);
  assert.doesNotMatch(p, /Details:/);
});

test("buildSubtaskPrompt: includes note when present", () => {
  const p = buildSubtaskPrompt("Ship release", "v2 with migration");
  assert.match(p, /Ship release/);
  assert.match(p, /Details: v2 with migration/);
});

test("buildSubtaskPrompt: clamps overly long input", () => {
  const p = buildSubtaskPrompt("x".repeat(1000), "y".repeat(5000));
  assert.ok(p.length < 3200, `prompt too long: ${p.length}`);
});

test("parseSubtasks: parses, trims, drops empties, clamps to 12", () => {
  const many = Array.from({ length: 20 }, (_, i) => `task ${i}`);
  const text = JSON.stringify({ subtasks: ["  a ", "", "   ", "b", ...many] });
  const out = parseSubtasks(text);
  assert.equal(out[0], "a");
  assert.equal(out[1], "b");
  assert.ok(!out.includes(""));
  assert.equal(out.length, 12);
});

test("parseSubtasks: invalid JSON → []", () => {
  assert.deepEqual(parseSubtasks("not json"), []);
  assert.deepEqual(parseSubtasks(JSON.stringify({ nope: 1 })), []);
});
