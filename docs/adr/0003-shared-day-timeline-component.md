# One shared Day-timeline component for both the Day view and the Calendar's Day mode

The app has two places that render an hour-by-hour day grid: the standalone **Day** view
(`src/timeline.jsx`, `DayView`) and the **Day mode** inside the **Calendar** page
(`src/calendar.jsx`). Until now these were two separate implementations of the same idea —
24 hour rows, time-positioned task blocks, lane layout for overlaps — with different CSS
(`.tl-*` vs `.day-*`). Only the standalone Day view had create-on-grid (drag-to-create on
desktop, tap-to-create on mobile) and the live "now" marker; the Calendar's Day mode had
neither.

We extract the hour grid plus its create behavior into a single shared component. Both the
standalone Day view and the Calendar's Day mode render it. The grid is the single source of
truth for day create; callers keep their own headers (the Calendar keeps its Month/Day
toggle and date nav, the Day view keeps its `ViewHeader`).

Creating on the grid opens the quick-add composer with the date and time pre-filled via
`setQuickAdd({ dueOffset, time, duration })` — the same store signal already used by the
standalone Day view, so the absolute `remindAt` path is unaffected.

## Consequences

- The Calendar's Day mode gains drag/tap create, the spine, and the live "now" line it
  previously lacked — it now looks and behaves like the real Day view, by construction.
- The duplicate `.day-grid` markup in `src/calendar.jsx` is removed in favor of the shared
  component; the `.tl-*` styling becomes the one day-grid style.
- Day create stays in one place. Anyone adding a create affordance to a day grid should use
  this component, not re-duplicate the grid.
- The standalone Day view and the Calendar's Day mode are now near-identical surfaces. They
  are kept as two entry points deliberately (one is a top-level view, one is a mode of the
  Calendar); if that redundancy is ever revisited, this component is what both depend on.
