# Task duration / time-blocking — design

**Date:** 2026-06-21 · **Feature:** E (A, B, D done).

## Goal

Add a task `duration` (minutes), and a day time-grid (in the Calendar) that shows timed tasks as blocks positioned by start time and sized by duration.

## Background (verified)

- Task fields: `time` ("HH:MM", the start-of-day time for a single-date task), `startTime`/`startOffset` (date-range case), `dueOffset` (day bucket). **No `duration` field exists.**
- `updateTask(id, patch)` (`store.jsx:244`) persists+syncs any non-text patch (blob sync) — `{duration}` works with no schema change. `addTask` defaults at `store.jsx:~316`.
- `CalendarView` (`src/calendar.jsx`) is month-only; local `selOff` tracks the selected day; clicking a cell shows that day's task list below. Store access: `{ tasks, setSelectedId, toggleTask, selectedId }`. Uses `ViewHeader` with a `right` slot.
- Time is edited in `DatePage` (in `detail.jsx:~992`) via an "include time" toggle + `<input type="time">`, persisted through `updateTask`. A duration picker slots in right after the time row.
- No hour-grid CSS exists; build with `position:relative` hour column + `position:absolute` blocks. CSS vars: `--border`, `--bg-elev`, `--p1/2/3`, `--today`, `--accent`, shadows.
- Mobile reuses `CalendarView` (`compact`); its scroll container handles a tall grid fine.

## Decisions (defaults)

1. **`duration` in minutes**, default `null`. A block with no duration renders at a default **60-minute** height (display only; `null` is not written).
2. **Edit duration in `DatePage`** with preset chips: None, 15m, 30m, 45m, 1h, 1.5h, 2h, 3h → `updateTask(id, { duration })` (None → `null`). Shown only when a time is set.
3. **Day grid via internal Month/Day toggle** in `CalendarView` (local `dayMode` state). No new view type / routing. Clicking a month cell while switching to Day mode focuses that day (reuse `selOff`).
4. **Day grid contents:** for the selected day, timed not-done tasks (`time` set, `dueOffset === selOff`) render as absolute blocks; untimed tasks for that day appear in an "Unscheduled" strip above the grid. Done tasks excluded.
5. **Overlap:** tasks overlapping in time share the column via equal-width lanes (calendar-event layout). Block `left = lane/lanes`, `width = 1/lanes`.
6. **Grid window:** all 24 hours, vertically scrollable, auto-scrolled to ~07:00 on open. Hour height from a CSS var (`--hour-height`, 56–64px).
7. **Interactions:** click a block → `setSelectedId(task.id)` (opens detail). Drag-to-move and drag-to-resize are **out of scope** (future); duration/time are changed in DatePage.
8. **`dateRangeLabel` untouched** to avoid label/test regressions. Duration is surfaced in the grid block and the DatePage picker only.

## Architecture

- **`src/timegrid.js`** (pure, tested): `parseHM(s)`→minutes|null; `fmtHM(min)`→"HH:MM"; `blockMinutes(task, default)`; `layoutDayTasks(tasks, {defaultDuration})`→`[{task,startMin,endMin,lane,lanes}]` sorted by start, with greedy lane assignment grouped into overlap clusters.
- **`src/calendar.jsx`**: add `dayMode` toggle in the header; when on, render a `DayGrid` (hour rulers + absolutely-positioned blocks from `layoutDayTasks`, plus the Unscheduled strip). Reuse `selOff` for the focused day.
- **`src/detail.jsx`**: duration chips in `DatePage`.
- **`src/store.jsx`**: `addTask` default `duration: null`.
- **`src/index.css`**: `--hour-height` var + `.day-grid`, `.day-grid-hours`, `.time-block`, `.day-unscheduled` classes.
- No schema/sync change.

## Out of scope

Drag-to-move/resize on the grid, week view, multi-day blocks on the grid, end-time editing separate from duration, conflict warnings.

## Testing

`tests/timegrid.test.mjs` (`node --test`):
- `parseHM`: valid "09:30"→570, invalid/"25:00"/null→null; `fmtHM(570)`→"09:30", wraps 24h.
- `blockMinutes`: uses `task.duration` when >0, else default.
- `layoutDayTasks`: excludes tasks without time; two non-overlapping → both lane 0, lanes 1; two overlapping → lanes 2 (lane 0 and 1); the A(9-10)/B(9:30-10:30)/C(10-11) case → A lane0/lanes2, B lane1/lanes2, C lane0/lanes2; default duration applied when `duration` unset.

UI verified by `npm run build` + review (no component tests). Acknowledged.

## Acceptance

- A task's duration is settable in DatePage and persists.
- Calendar Day mode shows timed tasks as blocks at the right position/height; overlaps split into lanes; untimed tasks listed separately; clicking a block opens it.
- New unit tests pass; full suite green; build succeeds.
