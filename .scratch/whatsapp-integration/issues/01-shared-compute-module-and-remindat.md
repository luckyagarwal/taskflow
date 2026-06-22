# 01 — Shared compute module + remindAt foundation

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

The prefactor everything else builds on. Establish one shared place for task parsing and reminder-time
computation, and introduce the absolute reminder timestamp the rest of the feature depends on.

End-to-end behavior delivered:

- Task parsing and recurrence advancement are computed by a single shared module that both the app and
  the backend import — no duplicated logic.
- Every Task with a due date has an absolute `remindAt` (epoch milliseconds), derived from its
  `dueOffset` + `time`, or 09:00 for date-only tasks, resolved in the fixed app timezone (Asia/Kolkata).
  A Task with no due date has `remindAt = null`. A `reminderSent` flag exists and is cleared whenever
  `remindAt` changes.
- Creating or editing a dated Task in the app sets/updates `remindAt`. Advancing a recurring Task
  recomputes it.
- A one-time backfill computes `remindAt` for existing Tasks and marks any whose `remindAt` is already
  in the past as `reminderSent`, so no historical reminder fires later.

These are new JSON fields on the task record; no database schema migration is required.

Note: there is no date library in the project (deps are dexie/react/lucide only) and no existing
timezone helper. Do the Asia/Kolkata resolution with `Intl.DateTimeFormat` (or a fixed +05:30 offset)
and cover the offset with unit tests — this is the easiest part to get subtly wrong.

## Acceptance criteria

- [ ] `parseTask`, `advanceRecurring`, and a new `computeRemindAt` live in one shared module imported by both the frontend and backend code paths.
- [ ] `computeRemindAt` returns the correct absolute instant for: a timed task, a date-only task (09:00), and a no-date task (null), in the fixed timezone.
- [ ] Saving a dated Task in the app writes a correct `remindAt`; editing its date updates it; clearing its date sets it to null.
- [ ] Advancing a recurring Task recomputes `remindAt` and clears `reminderSent`.
- [ ] The backfill sets `remindAt` on all existing dated Tasks and marks past-due ones `reminderSent`; no task is left dated-but-unset.
- [ ] Unit tests cover `parseTask`, `computeRemindAt`, and `advanceRecurring` (prior art: the existing parse unit tests).

## Blocked by

None - can start immediately.
