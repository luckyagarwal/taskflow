# 07 — Snooze by reply

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

Let the user defer a Reminder by replying with a time, instead of tapping a button.

End-to-end behavior delivered:

- The bot remembers which Task the most recent Reminder was about (the "last reminder context").
- A reply containing a time phrase ("in 2 hours", "tomorrow 8am") is parsed by the shared parser into a
  new `remindAt` for that Task, and `reminderSent` is cleared so the new Reminder will fire.
- A confirmation of the new time is sent back.

## Acceptance criteria

- [ ] After a Reminder, a time-phrase reply reschedules that specific Task's `remindAt` and clears `reminderSent`.
- [ ] The "last reminder context" correctly identifies the Task a bare reply refers to.
- [ ] A reply that is not a recognizable time is treated as a normal Capture (new Task), not a snooze.
- [ ] Handler test confirms a reply reschedules the right Task against the fake D1 + fake client.

## Blocked by

- 05 — Reminder scheduler (cron Worker) + delivery
- 06 — Reminder actions: Done + recurring advance
