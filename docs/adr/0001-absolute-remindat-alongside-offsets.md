# 1. Store an absolute `remindAt` alongside relative offsets

Date: 2026-06-21
Status: Accepted

## Context

TaskFlow stores due dates as `dueOffset` — a number of days **relative to "today"**, resolved
against `new Date()` each time it is read. There is no absolute date, no stored timezone, and no
daily rollover that rewrites offsets. This works for an interactive UI that is always re-rendered
"today", but it has no fixed point in time.

The WhatsApp feature needs to fire reminders from a **server cron with no browser open**. A server
cannot act on "1 day from today" — it needs an exact instant. We considered three options:

1. Migrate the whole app from offsets to absolute dates (deriving offsets for display).
2. Add an absolute timestamp used only by the reminder engine, keeping offsets as the source of
   truth for the UI.
3. Only remind for WhatsApp-created tasks with explicit times.

## Decision

Add an absolute **`remindAt`** field (epoch milliseconds) to every Task with a due date, computed
from `dueOffset` + `time` (or a 9:00 AM default) resolved in a **fixed timezone, Asia/Kolkata**.
The relative offsets remain the source of truth for the UI; `remindAt` is a derived, denormalised
value the reminder engine reads. It is recomputed whenever the date/time is edited or a recurring
task advances, and computed by a **single shared function** imported by the frontend, the webhook,
and the cron worker so all three agree exactly.

## Consequences

- **Good:** No app-wide refactor. The reminder engine gets the fixed point it needs. Offset-based
  views are untouched.
- **Cost:** Two representations of the same date now coexist. Because offsets drift and `remindAt`
  is fixed, an old task's displayed date and its reminder time can disagree. We accept this — a
  fixed reminder time is more correct than a drifting offset, and recomputing `remindAt` on edit
  keeps new tasks aligned.
- **Cost:** Every save path that changes a date must recompute `remindAt` (frontend store, webhook,
  recurring advance). Forgetting one means a stale reminder.
- **Reversible-ish:** `remindAt` is additive. Removing it later is easy; but once the cron depends
  on it, correctness depends on every writer maintaining it.
- **Note:** Timezone is hardcoded (single-user). Going multi-user would require per-user timezones
  and re-deriving every `remindAt`.
