# Board (Kanban) View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** A standalone Board view: 5 status columns, drag a card to a column to change its status.

**Architecture:** Pure grouping logic in `src/status.js` (tested); `BoardView` in `src/board.jsx`; wire into both view switches + nav. Reuse `TaskRow` (density card) as the card and the native HTML5 drag pattern. No model/sync change.

**Spec:** `docs/superpowers/specs/2026-06-21-board-view-design.md`

---

## Task 1: Pure status/board logic + tests (`src/status.js`)

**Files:** Create `src/status.js`, create `tests/status.test.mjs`.

- [ ] **Step 1: Write `tests/status.test.mjs`:**

```js
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
    mk({ id: "c", done: true, status: "blocked", doneOffset: -3 }),   // recent done → Done
    mk({ id: "d", done: true, status: "done", doneOffset: -30 }),     // old done → excluded
    mk({ id: "e", status: "waiting", projectId: "p2" }),              // other project
  ];
  const cols = groupTasksByStatus(tasks, { recentDoneDays: 7 });
  assert.deepEqual(cols.planned.map((t) => t.id), ["a"]);
  assert.deepEqual(cols.inprogress.map((t) => t.id), ["b"]);
  assert.deepEqual(cols.done.map((t) => t.id), ["c"]);
  assert.deepEqual(cols.waiting.map((t) => t.id), ["e"]);

  const filtered = groupTasksByStatus(tasks, { projectId: "p1", recentDoneDays: 7 });
  assert.deepEqual(filtered.waiting.map((t) => t.id), []); // e excluded by project filter
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/status.test.mjs`.

- [ ] **Step 3: Implement `src/status.js`:**

```js
// src/status.js — task status model + Kanban board grouping (pure, no React).

export const STATUS_ORDER = ["planned", "inprogress", "blocked", "waiting", "done"];

export const STATUS_LABELS = {
  planned: "Planned",
  inprogress: "In Progress",
  blocked: "Blocked",
  waiting: "Waiting",
  done: "Done",
};

// Patch applied when a task moves to `target` status — keeps done/doneOffset
// consistent with the rest of the app (see detail.jsx).
export function statusPatch(target) {
  if (target === "done") return { status: "done", done: true, doneOffset: 0 };
  return { status: target, done: false, doneOffset: null };
}

// Board column for a task. Done tasks always go to 'done' (ignore stale status).
export function columnOf(task) {
  if (task.done) return "done";
  return STATUS_ORDER.includes(task.status) ? task.status : "planned";
}

// Group board-visible tasks into status columns.
// Visible = not done, OR done within the last `recentDoneDays` days.
// projectId null = all projects.
export function groupTasksByStatus(tasks, { projectId = null, recentDoneDays = 7 } = {}) {
  const cols = {};
  for (const k of STATUS_ORDER) cols[k] = [];
  for (const t of tasks) {
    if (projectId && t.projectId !== projectId) continue;
    const visible = !t.done || (typeof t.doneOffset === "number" && t.doneOffset >= -recentDoneDays);
    if (!visible) continue;
    cols[columnOf(t)].push(t);
  }
  return cols;
}
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/status.test.mjs`, then `npm test` (full suite green).

- [ ] **Step 5: Commit** — `git add src/status.js tests/status.test.mjs && git commit -m "feat(board): pure status/board grouping helpers + tests"` (+ Co-Authored-By trailer).

---

## Task 2: BoardView component + wiring (`src/board.jsx`, `src/App.jsx`, `src/MobileApp.jsx`, `src/index.css`)

**Files:** Create `src/board.jsx`; modify `src/App.jsx`, `src/MobileApp.jsx`, `src/index.css`. Read each target before editing.

Behaviour:

- [ ] **`src/board.jsx` — `BoardView`:**
  - Pull `tasks`, `projects`, `updateTask` from the store (use the same hook the other views use — check how `TodayView`/`ProjectView` access the store in `views.jsx`).
  - Local state: `projectFilter` (default `null`) and `draggedId` (default `null`).
  - `const cols = groupTasksByStatus(tasks, { projectId: projectFilter })` (import from `./status.js`).
  - Header: view title "Board" + a `<select>` for project filter ("All projects" + `projects` by name → sets `projectFilter`).
  - Render a horizontal flex row (`.board-scroll`) of 5 `.board-column`s in `STATUS_ORDER`. Each column: a `.board-column-head` with `STATUS_LABELS[status]` and the count; then the column's tasks rendered with the existing `TaskRow` (import from `./ui.jsx`) using `density="card"` and an `onOpen` that opens the task detail the same way other views do (check how `TodayView` opens a task — likely `setSelected`/`openTask` from the store).
  - Each card is `draggable`; `onDragStart` sets `draggedId = task.id` (and `e.dataTransfer.effectAllowed='move'`). Each column has `onDragOver={e=>e.preventDefault()}` and `onDrop` that, if `draggedId` and the task's current column differs from this column, calls `updateTask(draggedId, statusPatch(status))` then clears `draggedId`. `onDragEnd` clears `draggedId`.
- [ ] **`src/App.jsx`:** add `case 'board': content = <BoardView />; break;` to `MainContent` (import BoardView from `./board.jsx`). Add a sidebar `NavItem` (icon `LayoutGrid` from lucide-react) labeled "Board", active when `view.type==='board'`, `onClick={() => setView({ type:'board' })}`, placed with the other primary nav items (Today/Upcoming/etc). Bypass the `maxWidth:760` constraint when `view.type==='board'` (allow full width).
- [ ] **`src/MobileApp.jsx`:** add `case 'board'` to `MobileContent` rendering `<BoardView />`. Add a way to reach it — either a `TabBar` tab or a card in `BrowseView` (match existing pattern; a BrowseView grid card "Board" is least disruptive).
- [ ] **`src/index.css`:** add:

```css
.board-scroll { display: flex; flex-wrap: nowrap; gap: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 8px; align-items: flex-start; }
.board-column { min-width: 280px; flex: 0 0 280px; background: var(--bg-side); border: 1px solid var(--border); border-radius: 10px; padding: 8px; }
.board-column-head { font-size: 12px; font-weight: 600; color: var(--text-2); padding: 4px 6px 8px; display: flex; justify-content: space-between; }
.board-column.drag-over { outline: 2px dashed var(--accent); }
```
(Optionally toggle `.drag-over` on the column under the cursor — nice-to-have, not required.)

**Verify:** `npm run build` succeeds after the component and after wiring. `npm test` stays green.

- [ ] **Commit** — one commit: `git add src/board.jsx src/App.jsx src/MobileApp.jsx src/index.css && git commit -m "feat(board): Kanban board view with drag-to-change-status"` (+ trailer).

---

## Task 3: Final verification

- [ ] `npm test` → green (parse + projects + status + sync + storage + sw).
- [ ] `npm run build` → succeeds.
- [ ] `git push origin main`.

---

## Self-Review

- Spec → tasks: 5 status columns (T1 STATUS_ORDER, T2 render), drag-to-status incl. done compound patch (T1 statusPatch, T2 drop), recent-done window + project filter (T1 groupTasksByStatus, T2 header), standalone view + nav + maxWidth bypass + mobile scroll (T2). Covered.
- No placeholders in T1 (full code + tests). T2 integrates into large JSX; it names exact helper APIs, store actions, and class names, and says to read the files — appropriate.
- Type consistency: `statusPatch`, `columnOf`, `groupTasksByStatus`, `STATUS_ORDER`, `STATUS_LABELS` identical across `src/status.js`, tests, and T2. Drop handler uses `updateTask(id, statusPatch(status))` matching the verified store action.
- Known limitation noted: no component test harness; UI verified via build + review.
