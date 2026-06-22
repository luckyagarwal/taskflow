# A shared Day-timeline component, owned by the Calendar's Day mode

> Update (supersedes the original framing below): the standalone **Day** view was removed
> from navigation and deleted (`src/timeline.jsx`). The Calendar's **Day mode** is now the
> only entry point to the hour timeline. The shared `DayTimeline` component
> (`src/daygrid.jsx`) lives on as that single implementation. The reasoning below still
> holds — there is one grid, not two — there is just one caller now instead of two.

The app had two places that rendered an hour-by-hour day grid: the standalone **Day** view
(`src/timeline.jsx`, `DayView`) and the **Day mode** inside the **Calendar** page
(`src/calendar.jsx`). These were two separate implementations of the same idea —
24 hour rows, time-positioned task blocks, lane layout for overlaps — with different CSS
(`.tl-*` vs `.day-*`). Only the standalone Day view had create-on-grid (drag-to-create on
desktop, tap-to-create on mobile) and the live "now" marker; the Calendar's Day mode had
neither.

We extracted the hour grid plus its create behavior into a single shared component
(`DayTimeline`). The grid is the single source of truth for day create; callers keep their
own headers (the Calendar keeps its Month/Day toggle and date nav).

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
- The redundancy was later resolved by removing the standalone Day view entirely (it
  duplicated what the Calendar's Day mode now offers). `DayTimeline` has a single caller —
  the Calendar — but stays a separate component so the Calendar's Month/Day toggle code
  reads cleanly and a second caller can reuse it later.
