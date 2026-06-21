# Board (Kanban) view — design

**Date:** 2026-06-21 · **Feature:** D (parity batch; A, B done).

## Goal

A board view with task cards in columns, where dragging a card to a column changes the task's `status`.

## Background (verified)

- Tasks carry `status` ∈ {planned, inprogress, blocked, waiting, done}; default `planned` (`store.jsx:319`); legacy tasks guarded with `status || 'planned'`. Canonical labels/icons in `detail.jsx:10` `STATUS_CHOICES` (duplicated in `ui.jsx:169`).
- `updateTask(id, patch)` (`store.jsx:244`) syncs immediately for non-text patches. Status→done must also set `{ done:true, doneOffset:0 }`; status away from done sets `{ done:false, doneOffset:null }` (mirrors `detail.jsx:517`).
- View routing: `view={type,id}` (`store.jsx:95`); switch in `App.jsx:423` `MainContent` and `MobileApp.jsx:332` `MobileContent`; sidebar nav in `App.jsx:~374`; mobile tabs `MobileApp.jsx:~127`.
- `TaskRow` (`ui.jsx:128`) with `density="card"` is reusable as a card. Native HTML5 drag pattern in `views.jsx:51` (TaskGroup). `Sel` selectors `store.jsx:926`. CSS `src/index.css` (vars `--bg-elev`, `--border`, `--p1/2/3`, `--today`, shadows). `MainContent` has a `maxWidth:760` that must be bypassed for the board.

## Decisions (defaults)

1. **Standalone top-level view** `type:'board'`, reached from the sidebar (desktop) and mobile nav. Not a per-project toggle (less coupling; ships faster).
2. **Columns = the 5 statuses**, in order planned → inprogress → blocked → waiting → done.
3. **Column membership:** a `done` task always sits in the Done column (ignoring a stale `status`); otherwise the column is `status || 'planned'`.
4. **Board-visible set:** all not-done tasks, plus done tasks completed within the last 7 days (so Done isn't unbounded). Older done tasks live in the Logbook, not the board.
5. **Drag-drop:** dropping a card on a column applies `statusPatch(targetStatus)` via `updateTask`. Into Done → completes it; out of Done → un-completes it.
6. **Project filter:** a header `<select>` ("All projects" + projects) narrows the board. Default all.
7. **No reordering within a column** in this version (drag only changes column/status). Within-column order = existing `sortTasks` default. Reordering is a future extension.
8. **Mobile:** columns in a horizontal-scroll flex row (min-width ~280px, peek next column). Drag-drop best-effort; tapping a card opens detail where status can also be changed.

## Architecture

- **`src/status.js`** (pure, no React, unit-tested): `STATUS_ORDER`, `STATUS_LABELS`, `statusPatch(target)`, `columnOf(task)`, `groupTasksByStatus(tasks, {projectId, recentDoneDays})`.
- **`src/board.jsx`**: `BoardView` component — header (title + project filter), a row of columns from `groupTasksByStatus`, each rendering `TaskRow` cards; native drag handlers tracking the dragged task id; drop calls `updateTask(id, statusPatch(col))`.
- **Wiring:** add `case 'board'` to both view switches; a sidebar `NavItem` (icon `LayoutGrid`) and a mobile nav entry; bypass `maxWidth:760` when `view.type==='board'`; board CSS classes (`.board-scroll`, `.board-column`, `.board-column-head`) in `index.css`.
- No data-model, schema, or sync change.

## Out of scope

Per-project board toggle, within-column reordering, custom columns, swimlanes, WIP limits.

## Testing

`tests/status.test.mjs` (`node --test`):
- `statusPatch('done')` → `{status:'done',done:true,doneOffset:0}`; `statusPatch('inprogress')` → `{status:'inprogress',done:false,doneOffset:null}`.
- `columnOf`: done→'done'; missing status→'planned'; 'blocked'→'blocked'.
- `groupTasksByStatus`: correct column buckets; excludes done older than `recentDoneDays`; includes recent done; `projectId` filter; done task with stale non-done status still lands in Done.

UI verified by `npm run build` + code review (no component test harness exists). Acknowledged.

## Acceptance

- Board shows 5 status columns; active tasks bucketed by status; recently-done in Done.
- Dragging a card to another column changes its status; into/out of Done toggles completion correctly.
- Project filter narrows the board.
- New unit tests pass; full suite green; `npm run build` succeeds.
