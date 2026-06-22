# 06 — Reminder actions: Done + recurring advance

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

Make a Reminder actionable. The Reminder carries a Done quick-reply button. Tapping Done completes the
Task from WhatsApp; for a recurring Task it advances to the next occurrence instead of just finishing.

End-to-end behavior delivered:

- Each Reminder includes a Done button.
- Done on a one-off Task marks it complete (via the shared write path).
- Done on a recurring Task advances it to its next occurrence, recomputes `remindAt`, and clears
  `reminderSent`, so the next Reminder will fire.
- A confirmation is sent back.

## Acceptance criteria

- [ ] The Reminder message includes a Done button.
- [ ] Done on a non-recurring Task marks it done and confirms.
- [ ] Done on a recurring Task advances the occurrence, recomputes `remindAt`, and clears `reminderSent`.
- [ ] Handler tests cover Done on both one-off and recurring Tasks against the fake D1 + fake client.

## Blocked by

- 05 — Reminder scheduler (cron Worker) + delivery
