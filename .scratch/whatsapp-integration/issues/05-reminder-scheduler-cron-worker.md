# 05 — Reminder scheduler (cron Worker) + delivery

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

The outbound half: deliver a WhatsApp Reminder at a Task's `remindAt`, with no app open.

End-to-end behavior delivered:

- A separate scheduled Worker runs on a one-minute cron, bound to the same database. (The app's Pages
  Functions cannot run scheduled jobs, so this is its own deployable.)
- Each run selects Tasks that are due — `now >= remindAt`, not done, `reminderSent` false, and not more
  than ~24h late — sends a Reminder, and marks them `reminderSent`.
- Reminders are sent as an approved Utility template (required outside the 24-hour service window) and
  carry the Task title.
- The injectable WhatsApp client from the capture slice is reused so the scheduler is testable without
  network calls.

## Acceptance criteria

- [ ] The scheduler is a standalone Worker with a one-minute cron bound to the same D1 database.
- [ ] A due Task triggers exactly one Reminder and is marked `reminderSent`; a second run does not resend it.
- [ ] Tasks that are done, have no `remindAt`, or are more than ~24h late are not sent.
- [ ] Reminders use the approved Utility template format.
- [ ] Cron-run tests against the fake D1 + fake client cover: sends once, skips done, respects the 24h-late cutoff.

## Blocked by

- 01 — Shared compute module + remindAt foundation
