import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHM, fmtHM, blockMinutes, layoutDayTasks } from "../src/timegrid.js";

test("parseHM", () => {
  assert.equal(parseHM("09:30"), 570);
  assert.equal(parseHM("00:00"), 0);
  assert.equal(parseHM("23:59"), 1439);
  assert.equal(parseHM("25:00"), null);
  assert.equal(parseHM("bad"), null);
  assert.equal(parseHM(null), null);
});

test("fmtHM", () => {
  assert.equal(fmtHM(570), "09:30");
  assert.equal(fmtHM(0), "00:00");
  assert.equal(fmtHM(1500), "01:00");
});

test("blockMinutes: duration when >0 else default", () => {
  assert.equal(blockMinutes({ duration: 45 }, 60), 45);
  assert.equal(blockMinutes({ duration: null }, 60), 60);
  assert.equal(blockMinutes({ duration: 0 }, 60), 60);
  assert.equal(blockMinutes({}, 30), 30);
});

test("layoutDayTasks: excludes untimed; non-overlap both lane 0", () => {
  const out = layoutDayTasks([
    { id: "a", time: "09:00", duration: 60 },
    { id: "b", time: "11:00", duration: 60 },
    { id: "c", time: null },
  ], { defaultDuration: 60 });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((o) => [o.task.id, o.lane, o.lanes]), [["a", 0, 1], ["b", 0, 1]]);
});

test("layoutDayTasks: overlap splits into 2 lanes", () => {
  const out = layoutDayTasks([
    { id: "a", time: "09:00", duration: 60 },
    { id: "b", time: "09:30", duration: 60 },
  ], { defaultDuration: 60 });
  assert.deepEqual(out.map((o) => [o.task.id, o.lane, o.lanes]), [["a", 0, 2], ["b", 1, 2]]);
});

test("layoutDayTasks: A/B/C chain — A&C share lane 0, B lane 1, all lanes 2", () => {
  const out = layoutDayTasks([
    { id: "a", time: "09:00", duration: 60 },
    { id: "b", time: "09:30", duration: 60 },
    { id: "c", time: "10:00", duration: 60 },
  ], { defaultDuration: 60 });
  const m = Object.fromEntries(out.map((o) => [o.task.id, [o.lane, o.lanes]]));
  assert.deepEqual(m.a, [0, 2]);
  assert.deepEqual(m.b, [1, 2]);
  assert.deepEqual(m.c, [0, 2]);
});
