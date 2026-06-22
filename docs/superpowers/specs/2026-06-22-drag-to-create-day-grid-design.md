# Drag/Tap to Create a Task on the Day Grid

**Date:** 2026-06-22
**Status:** Approved, pending implementation plan

## Goal

Let the user create a task directly on the Day view's time grid, the way Google
Calendar lets you drag out an event. On desktop this is a click-and-drag that
selects a time range. On mobile, where the grid scrolls vertically, it is a tap
on an empty slot (no drag), so the create gesture never fights scrolling.

The result is a faster path to a timed, sized task than opening the composer and
typing a time by hand.

## Background

The Day view already exists in `src/timeline.jsx` (`DayView`). It renders a
to-scale 24-hour grid (`.tl-track`, 60px per hour, constant `HOUR_H = 60`) on
both desktop (`App.jsx:580`) and mobile (`MobileApp.jsx:359`, passed `compact`).

Tasks already store the two fields a drag produces:
- `time` — a `"HH:MM"` string (start time)
- `duration` — minutes

`addTask(partial)` (`store.jsx:358`) accepts `{ title, dueOffset, time, duration, ... }`,
so creating a timed, sized task is a single call. No data-model change is needed.

The composer modal is gated by store state `quickAdd` / `setQuickAdd`:
- The global "+" button calls `setQuickAdd(true)` (`App.jsx:493`).
- `App.jsx:934` renders `{quickAdd && <QuickAddModal .../>}`.
- `MobileApp.jsx:435` renders its own `InlineComposer` modal.

Today `setQuickAdd` holds only a boolean, and the composer never sets `duration`.

## Behavior

### Desktop — drag to select a time range

1. Mouse-down on empty grid space (not on an existing `.tl-block`) records the
   start Y position, converted to a start minute.
2. Dragging shows a live "ghost" block (`.tl-ghost`) that follows the pointer.
   Both edges are snapped to 5-minute steps. The block shows the range label,
   e.g. `09:15 – 10:05 · 50m` (reuses `fmtHM` / `H.fmtDuration`).
3. Dragging up (end above start) is allowed — the range is normalized so start
   is always the earlier time.
4. Mouse-up finalizes. If the drag moved less than a small threshold (a plain
   click), it is ignored — no block is created. Otherwise the composer opens via
   `setQuickAdd({ dueOffset: selOff, time, duration })`, prefilled. Nothing is
   saved until the user types a title and confirms; Escape / clicking the scrim
   cancels with no side effects.
5. Mouse-down that starts on an existing `.tl-block` does NOT start a drag-create;
   it keeps the current behavior (opens that task).

### Mobile — tap to create

1. Tap on empty grid space. The tapped Y is converted to a minute and snapped to
   5 minutes.
2. The composer opens prefilled with that time and a default 60-minute duration,
   via the same `setQuickAdd({ dueOffset, time, duration })` path.
3. No drag, so the gesture never conflicts with the scrolling grid. This matches
   the Google / Apple / Notion Calendar mobile pattern.
4. Tapping an existing `.tl-block` keeps its current behavior (opens that task).

`DayView` already receives the `compact` prop on mobile, which is used to pick
the tap path over the drag path.

## Components

Each unit is small and has one job.

### 1. `src/timegrid.js` — pure helpers (no React, unit-tested)

Add to the existing module:
- `yToMin(y, hourH)` — pixel offset within the track → minute of day (0–1439).
- `snapMin(min, step)` — round a minute value to the nearest `step` (default 5),
  clamped to 0–1439.
- `makeRange(aMin, bMin, { step = 5, minDur = 5 })` — given two raw minute values
  (drag start and end, in any order), return `{ startMin, durationMin }` with
  both edges snapped, start before end, and at least `minDur` minutes long.

Existing `fmtHM` is reused for labels. These are pure functions so they get
direct unit tests in `tests/` (the repo already has `tests/*.test.mjs`).

### 2. `src/timeline.jsx` (`DayView`) — interaction layer

- Add a transparent overlay (or pointer handlers on the existing `.tl-track`)
  that captures create gestures on empty space only.
- Desktop path (pointer events): `onPointerDown` → record start minute and a
  `dragging` state; `onPointerMove` → update the ghost end minute; `onPointerUp`
  → if moved past threshold, compute `{ startMin, durationMin }` with `makeRange`,
  convert start to `"HH:MM"` via `fmtHM`, and call
  `setQuickAdd({ dueOffset: selOff, time, duration })`. Below threshold, do nothing.
- Render a `.tl-ghost` block while dragging, positioned/sized like a real
  `.tl-block` (top = `startMin/60*HOUR_H`, height from duration), showing the
  range label.
- Mobile path (`compact === true`): a tap handler on empty space converts Y →
  snapped minute, defaults duration to 60, and calls the same `setQuickAdd(...)`.
- Guard: handlers must ignore events whose target is inside an existing
  `.tl-block` so task-open behavior is preserved.

### 3. `src/composer.jsx` — accept time + duration prefill

- `InlineComposer` gains `defaultTime = null` and `defaultDuration = null` props.
  Initialize the existing `time` state from `defaultTime`; add a `duration` value
  carried from `defaultDuration`.
- `submit` adds `duration` to the `addTask({...})` call. Existing precedence for
  `time` (`taskData.time || time || null`) is kept, so a time typed in the title
  still wins over the prefill; otherwise the prefill flows through.
- `QuickAddModal` gains a `prefill` prop and passes
  `defaultDue` / `defaultTime` / `defaultDuration` down to `InlineComposer`.

### 4. `src/store.jsx` — prefill-carrying quickAdd

- `setQuickAdd` accepts either `true` (unchanged global "+" behavior) or an
  object `{ dueOffset, time, duration }`. The state simply holds whatever is
  passed. No other store change.

### 5. `src/App.jsx` / `src/MobileApp.jsx` — wire prefill into the composer

- `App.jsx:934`: pass `prefill={typeof quickAdd === 'object' ? quickAdd : null}`
  to `QuickAddModal`.
- `MobileApp.jsx`: read the same prefill object from `quickAdd` and pass
  `defaultDue` / `defaultTime` / `defaultDuration` into its `InlineComposer`.
- The global "+" button still calls `setQuickAdd(true)` and opens an empty
  composer exactly as today.

## Data flow

```
DayView gesture (drag end / tap)
  → makeRange + fmtHM  →  { dueOffset, time, duration }
  → setQuickAdd(prefill)            [store]
  → QuickAddModal / mobile composer reads prefill
  → InlineComposer prefilled (title still empty, focused)
  → user types title, confirms
  → addTask({ title, dueOffset, time, duration, ... })
  → task appears on the Day grid as a sized block
```

## Error handling / edge cases

- **Plain click (no drag) on desktop:** below movement threshold → ignored, no
  task, no composer.
- **Drag upward:** normalized so start is the earlier time.
- **Drag past midnight / off the grid:** minutes clamped to 0–1439 by `snapMin`;
  duration clamped so start + duration stays within the day.
- **Gesture starting on an existing block:** ignored by the create layer; the
  task opens as before.
- **Cancel:** Escape or scrim click closes the composer with nothing saved
  (existing `QuickAddModal` behavior, unchanged).
- **Day being viewed:** the created task's `dueOffset` is the currently selected
  day offset (`selOff`), not always today.

## Testing

- **Unit (pure, in `tests/`):** `yToMin`, `snapMin`, and `makeRange` — snapping
  to 5, up-vs-down drag normalization, minimum duration, clamping at day edges.
- **Manual / preview:** desktop drag creates a correctly sized prefilled block;
  tiny click does nothing; drag on an existing block opens that task; mobile tap
  opens the composer with the right time and 60-minute default without
  interfering with scroll.

## Out of scope (YAGNI)

- Drag-to-create on the month calendar (`calendar.jsx`).
- Dragging existing blocks to move or resize them.
- Multi-day drag selection.

These can be separate features later; move/resize is the natural next one.
