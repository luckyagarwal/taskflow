# Time-Blocking (task duration + day grid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Add a `duration` field and a Calendar Day time-grid placing timed tasks as blocks.

**Architecture:** Pure layout in `src/timegrid.js` (tested). Duration chips in `DatePage` (detail.jsx). Day grid + Month/Day toggle in `calendar.jsx`. `addTask` default. CSS in index.css. No schema/sync change.

**Spec:** `docs/superpowers/specs/2026-06-21-time-blocking-design.md`

---

## Task 1: Pure time-grid layout + tests (`src/timegrid.js`)

**Files:** Create `src/timegrid.js`, create `tests/timegrid.test.mjs`.

- [ ] **Step 1: Write `tests/timegrid.test.mjs`:**

```js
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
  assert.equal(fmtHM(1500), "01:00"); // wraps past 24h
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
    { id: "a", time: "09:00", duration: 60 }, // 540-600
    { id: "b", time: "09:30", duration: 60 }, // 570-630
    { id: "c", time: "10:00", duration: 60 }, // 600-660
  ], { defaultDuration: 60 });
  const m = Object.fromEntries(out.map((o) => [o.task.id, [o.lane, o.lanes]]));
  assert.deepEqual(m.a, [0, 2]);
  assert.deepEqual(m.b, [1, 2]);
  assert.deepEqual(m.c, [0, 2]);
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/timegrid.test.mjs`.

- [ ] **Step 3: Implement `src/timegrid.js`:**

```js
// src/timegrid.js — pure helpers for the calendar day time-grid (no React).

export function parseHM(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function fmtHM(total) {
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockMinutes(task, defaultDuration = 60) {
  const d = task && task.duration;
  return typeof d === "number" && d > 0 ? d : defaultDuration;
}

// Lay timed tasks into lanes for a single day.
// Returns [{ task, startMin, endMin, lane, lanes }] sorted by start.
export function layoutDayTasks(tasks, { defaultDuration = 60 } = {}) {
  const items = [];
  for (const t of tasks) {
    const startMin = parseHM(t.time);
    if (startMin == null) continue;
    items.push({ task: t, startMin, endMin: startMin + blockMinutes(t, defaultDuration) });
  }
  items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = Math.max(...cluster.map((c) => c.lane + 1));
    for (const c of cluster) { c.lanes = lanes; out.push(c); }
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    if (it.startMin >= clusterEnd) flush(); // disjoint from current cluster
    let lane = laneEnds.findIndex((e) => e <= it.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endMin); }
    else laneEnds[lane] = it.endMin;
    it.lane = lane;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/timegrid.test.mjs`, then `npm test` (full green).

- [ ] **Step 5: Commit** — `git add src/timegrid.js tests/timegrid.test.mjs && git commit -m "feat(timeblock): pure day-grid layout helpers + tests"` (+ trailer).

---

## Task 2: `duration` field + DatePage picker (`src/store.jsx`, `src/detail.jsx`)

**Files:** Modify `src/store.jsx`, `src/detail.jsx`. Read both first.

- [ ] In `store.jsx` `addTask` defaults (~L316), add `duration: null` to the new-task object.
- [ ] In `detail.jsx` `DatePage` (~L992), after the time row, when the include-time toggle is on, render a row of duration preset chips: `None`(null), `15m`(15), `30m`(30), `45m`(45), `1h`(60), `1.5h`(90), `2h`(120), `3h`(180). The active chip reflects the task's current `duration` (None when null/0). Selecting a chip calls the same `updateTask(id, { duration })` path DatePage already uses for time (match how the time inputs persist — they call `updateTask` with the date/time patch; add `duration` similarly). Style with existing chip/toggle classes.

**Verify:** `npm run build` succeeds; `npm test` green.

- [ ] **Commit** — `git add src/store.jsx src/detail.jsx && git commit -m "feat(timeblock): task duration field + DatePage duration picker"` (+ trailer).

---

## Task 3: Calendar Day grid + Month/Day toggle (`src/calendar.jsx`, `src/index.css`)

**Files:** Modify `src/calendar.jsx`, `src/index.css`. Read calendar.jsx first.

- [ ] Add local `dayMode` boolean state (default false = month). Add a Month/Day toggle control to the `ViewHeader` `right` slot (two small buttons or a segmented toggle). Switching to Day keeps the current `selOff` as the focused day.
- [ ] When `dayMode` is true, render a `DayGrid` instead of (or below, replacing) the month grid:
  - Compute `dayTasks = tasks.filter(t => !t.done && t.dueOffset === selOff)`.
  - **Unscheduled strip:** `dayTasks.filter(t => parseHM(t.time) == null)` rendered as a compact list/chips above the grid (clicking → `setSelectedId`).
  - **Grid:** import `layoutDayTasks, fmtHM` from `./timegrid.js`. A `position:relative` column of height `24 * hourHeight` (read `--hour-height`, fallback 60). Render 24 hour rulers with `fmtHM(h*60)` labels. For each entry from `layoutDayTasks(dayTasks)`, render a `.time-block` with inline `top = startMin/60*hourHeight`, `height = max(22, (endMin-startMin)/60*hourHeight)`, `left = calc(LABEL_W + lane/lanes*(100% - LABEL_W))`, `width = (1/lanes)` of the track. Show task title + `fmtHM(startMin)`; color by priority (`H.priorityColor`) or project color. Click → `setSelectedId(task.id)`.
  - Auto-scroll the grid container to ~07:00 on entering day mode (`useRef` + `useEffect`, `scrollTop = 7 * hourHeight`).
- [ ] In `src/index.css` append:

```css
:root { --hour-height: 60px; }
.day-grid { position: relative; overflow-y: auto; max-height: calc(100vh - 220px); }
.day-grid-track { position: relative; }
.day-hour { height: var(--hour-height); border-top: 1px solid var(--border); font-size: 11px; color: var(--text-3); padding-left: 4px; box-sizing: border-box; }
.time-block { position: absolute; border-radius: 6px; background: var(--accent-soft); border: 1px solid var(--accent); color: var(--text); font-size: 12px; padding: 2px 6px; overflow: hidden; cursor: pointer; box-sizing: border-box; }
.day-unscheduled { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
```

**Verify:** `npm run build` succeeds; `npm test` green; manually reason: a 09:00 / 60m task sits at top 540px-equivalent with height one hour; two overlapping split half-width.

- [ ] **Commit** — `git add src/calendar.jsx src/index.css && git commit -m "feat(timeblock): calendar day time-grid with month/day toggle"` (+ trailer).

---

## Task 4: Final verification

- [ ] `npm test` → all green.
- [ ] `npm run build` → succeeds.
- [ ] `git push origin main`.

---

## Self-Review

- Spec → tasks: duration field+picker (T2), day grid + toggle + unscheduled strip + lane layout + click-to-open (T3), pure layout incl. default duration & overlap lanes (T1). `dateRangeLabel` untouched (no task modifies it ✓). Drag out of scope (no task adds it ✓). Covered.
- No placeholders in T1 (full code+tests). T2/T3 integrate into existing JSX with exact field names, helper APIs, persistence path, and CSS — read-the-file integration.
- Type consistency: `parseHM/fmtHM/blockMinutes/layoutDayTasks` identical across `src/timegrid.js`, tests, and T3 usage. `duration` field name consistent in store/detail/timegrid. Layout result keys `{task,startMin,endMin,lane,lanes}` used the same in T1 and T3.
- Known limitation: no component tests; UI via build + review.
