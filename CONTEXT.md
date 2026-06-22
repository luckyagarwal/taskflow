# TaskFlow — Domain Glossary

The shared language of TaskFlow. Definitions only — no implementation detail.

## Core task concepts

- **Task** — a single thing to do. Has a title, optional note, optional due date, optional clock time, priority, labels, status, and zero or more subtasks.
- **Subtask** — a child item of a Task. Has its own title, done flag, and its own optional dates. Lives inside its parent; never standalone.
- **dueOffset** — a Task's due date expressed as a whole number of days **relative to "today"** (0 = today, 1 = tomorrow, −1 = yesterday, `null` = no date / "someday"). It is *relative*, not absolute: its real calendar meaning is resolved against the current day each time it is read. There is no daily process that rewrites it, so a stored offset's calendar meaning shifts over time.
- **startOffset** — same idea as dueOffset, for an optional start date.
- **time** — a Task's clock time as `"HH:MM"` (24h), or `null`. Independent of the date; carries no timezone.
- **Recurring task** — a Task that, when completed, rolls forward to its next occurrence (daily / weekly / monthly / yearly / weekday) instead of finishing.

## Reminder concepts (WhatsApp feature)

- **remindAt** — the single **absolute** moment a reminder should fire, stored as epoch milliseconds. Computed from `dueOffset` + `time` (or the 9:00 AM default) resolved in the **fixed app timezone**. This is the bridge from TaskFlow's drifting relative offsets to a fixed point a server can act on. `null` when the Task has no due date (no reminder). Recomputed whenever the date/time is edited or a recurring task advances.
- **App timezone** — the one fixed timezone all remindAt values are computed in: **Asia/Kolkata**. Single-user app, so it is a constant, not per-user.
- **reminderSent** — marks that a Task's current remindAt has already been delivered, so the scheduler never sends it twice. Reset when remindAt changes.
- **Reminder** — a WhatsApp message the bot sends at remindAt, carrying the task title and quick actions.
- **Bot** — the WhatsApp identity (a dedicated phone number on the WhatsApp Cloud API) the user talks to. One bot, one user.
- **Capture** — turning an inbound WhatsApp message (typed or forwarded) into a Task.
- **Snooze** — rescheduling a fired Reminder by replying with a natural-language time; the bot reparses it into a new remindAt for the Task the last reminder referred to.
- **Last reminder context** — the bot's memory of which Task the most recent Reminder was about, so a bare reply like "in 2 hours" knows what it is rescheduling.
- **Allowed number** — the single WhatsApp number (held as a server secret) whose messages the bot accepts. Messages from any other number are ignored. This *is* the account link, for a single-user app.

## Identity & data

- **Single-tenant** — the entire database is one user's data. Cloudflare Access (Google login) gates entry; nothing in the data is partitioned by user. There is exactly one user.
- **Tickle** — a lightweight server signal (via SSE) telling an open app tab that data changed, so it pulls. A WhatsApp capture reaches an open tab this way within ~2s.
