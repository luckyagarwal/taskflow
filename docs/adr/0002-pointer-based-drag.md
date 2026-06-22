# Custom pointer-based drag-and-drop instead of the native HTML5 draggable API

To let a user drag a task to another day (the Board's Week mode, which has a column per
day of the week; and the day-grouped Upcoming view) or another status (the Board's Status
mode) on a phone, we use a custom pointer-event–based drag layer rather than the browser's
native HTML5 `draggable` / `dragstart` / `drop` API.

The native API is mouse-only: its drag events do not fire on touch, so it cannot work on
mobile, which is this app's primary surface. The existing draggable usages (Board status,
list reorder, subtask reorder, project/section reorder) are therefore all desktop-only
today. A pointer-based implementation (the same approach as the Day-timeline
drag-to-create) handles touch and mouse through one code path, and is reused to unify
within-day reordering with cross-day / cross-status moving.

## Consequences

- We own the drag mechanics: lift (long-press on touch, move-threshold on mouse), a
  floating drag clone, drop-zone hit-testing, edge auto-scroll, and cancel. The native
  API gave these for free on desktop.
- Long-press on a card now lifts it for dragging; releasing without moving falls back to
  the existing multi-select toggle, so that gesture is preserved.
- The Upcoming and Board views move off `draggable`; other native-draggable usages
  (project/section reorder) are left as-is until they too need touch support.
