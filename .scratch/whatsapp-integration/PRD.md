# PRD — TaskFlow WhatsApp Integration

> Produced by the `to-prd` skill from the grilling conversation, the plan, `CONTEXT.md`, and ADR 0001.
> Single-user app. Vocabulary follows the project glossary (Task, dueOffset, remindAt, Bot, Capture, Snooze, Allowed number).

## Problem Statement

I live in WhatsApp during the day, but my tasks live in TaskFlow. To capture a thought I have to
open the app, and TaskFlow can only remind me while a browser tab is open — so reminders silently
fail to reach me. I want to add tasks and get reliably nudged about them from inside WhatsApp, the
way Any.do works, without changing how I already use TaskFlow.

## Solution

A WhatsApp bot tied to my account. I message it (typed or forwarded) and it creates a task,
understanding the date and time from plain language, then confirms. When a task is due, the bot
messages me a reminder with a Done button; I can finish it there, or snooze it by replying with a
time. Reminders cover every dated task, whether I made it in the app or via the bot. Because it is
just me, there is no sign-up or linking screen — the bot only listens to my number.

## User Stories

1. As the user, I want to text the bot a plain sentence and have it become a task, so that I can
   capture something without opening the app.
2. As the user, I want the bot to read the date and time from my message ("tomorrow 5pm"), so that
   I do not have to set them manually.
3. As the user, I want the bot to understand relative dates ("in 3 days", "next week"), so that
   capture feels natural.
4. As the user, I want the bot to understand a clock time in 12h or 24h form, so that "5pm" and
   "17:00" both work.
5. As the user, I want a message with no date to still become a task (with no reminder), so that I
   can dump ideas into my inbox.
6. As the user, I want to forward a message from another chat to the bot and have it become a task,
   so that I can act on what someone sent me.
7. As the user, I want a confirmation reply showing the title and resolved due time, so that I know
   it was understood correctly.
8. As the user, I want messy phrasing the simple parser cannot handle to still be understood, so that
   I am not forced into rigid syntax.
9. As the user, I want a captured task to appear in my open TaskFlow app within seconds, so that the
   app and WhatsApp stay in sync.
10. As the user, I want only my own number to be able to drive the bot, so that no one else can add
    tasks to my list.
11. As the user, I want a reminder in WhatsApp at a task's due time, so that I am nudged even with no
    app open.
12. As the user, I want a task that has a date but no time to remind me at 9:00 AM that day, so that
    date-only tasks are not silent.
13. As the user, I want reminders to use my local time, so that they fire at the moment I expect.
14. As the user, I want each reminder to carry a Done button, so that I can complete a task in one tap.
15. As the user, I want tapping Done on a recurring task to roll it to its next occurrence, so that
    my habits keep cycling without opening the app.
16. As the user, I want to snooze a reminder by replying with a time ("in 2 hours"), so that I can
    defer without menus.
17. As the user, I want a snooze reply to apply to the task the last reminder was about, so that a
    short reply is unambiguous.
18. As the user, I want tasks I create in the TaskFlow app to also send WhatsApp reminders, so that
    where I made the task does not matter.
19. As the user, I want editing a task's date in the app to update its reminder, so that the reminder
    never fires at a stale time.
20. As the user, I want no flood of reminders when the feature first turns on, so that old overdue
    tasks do not all buzz me at once.
21. As the user, I want a reminder to fire only once, so that I am not pinged repeatedly for the same
    task.
22. As the user, I want a reminder missed during a short outage to still arrive shortly after, but a
    very old missed one to be skipped, so that I get timely nudges without surprise late buzzes.
23. As the user, I want the bot to ignore duplicate deliveries of the same message, so that a single
    text never creates two tasks.

## Implementation Decisions

- **Single tenant.** The whole database is one user's data; the backend does not partition by user.
  The bot accepts messages only from a single configured **allowed number** held as a server secret.
  No linking flow, no verification code, no settings UI.
- **remindAt as the time source.** Each dated Task gains an absolute `remindAt` (epoch milliseconds)
  computed from its `dueOffset` + `time` (or 09:00 default) resolved in a fixed timezone
  (Asia/Kolkata). The reminder scheduler reads `remindAt`; the existing relative offsets stay the
  source of truth for the UI. Two date representations coexist by design — see ADR 0001. A `reminderSent`
  flag prevents repeat sends and is cleared whenever `remindAt` changes.
- **Shared compute module.** `parseTask`, `advanceRecurring`, and a new `computeRemindAt` move into a
  single shared module imported by the frontend, the webhook, and the cron worker, so all three agree
  on parsing and timing.
- **Webhook.** A new inbound endpoint handles Meta's GET verification (verify token) and POST message
  delivery. Every POST is authenticated by verifying Meta's request signature (HMAC-SHA256 of the raw
  body with the app secret); unsigned or mismatched requests are rejected. The endpoint is excluded
  from Cloudflare Access so Meta can reach it; the signature check is the only gate. The handler routes
  a message to one of: capture, Done-button action, or snooze reply. Duplicate deliveries are de-duped
  by WhatsApp message id. The endpoint acknowledges fast and does work after responding.
- **Parsing path.** Capture first tries the regex parser; on low confidence it falls back to a
  Cloudflare Workers AI call (the `env.AI` binding, same pattern as the existing AI endpoints — no
  API key) that returns a structured task (title, dueOffset, time, priority, labels).
- **Writing tasks.** Captures and button actions write through the same upsert + last-write-wins logic
  the app's save endpoint uses, extracted into a shared write helper, so conflict rules are identical.
  The existing SSE "tickle" surfaces new tasks to an open tab; no new realtime mechanism.
- **Reminder scheduler.** Cloudflare Pages Functions cannot run scheduled jobs, so the scheduler is a
  separate Cloudflare Worker on a one-minute cron, bound to the same D1 database. Each run selects
  tasks that are due (now ≥ remindAt, not done, not yet sent, not more than ~24h late), sends the
  reminder, and marks them sent.
- **Reminder message.** Sent as an approved WhatsApp Utility template (required outside the 24-hour
  service window) carrying the task title and a Done quick-reply button.
- **Done semantics.** Done marks a non-recurring task complete; for a recurring task it advances to the
  next occurrence, recomputes `remindAt`, and clears `reminderSent`.
- **Snooze semantics.** A reply containing a time phrase is parsed into a new `remindAt` for the task
  referenced by the bot's stored "last reminder context", and `reminderSent` is cleared.
- **App parity + backfill.** The frontend computes/updates `remindAt` on every dated-task save. A
  one-time migration computes `remindAt` for existing tasks and marks any already in the past as
  already-sent, so the first cron run does not flood.
- **No schema migration.** Tasks are stored as JSON blobs, so `remindAt` and `reminderSent` are new
  JSON fields; the cron scans all non-deleted tasks each run, which is cheap at single-user scale.
- **Secrets.** WhatsApp token, phone-number id, verify token, app secret, and allowed number are
  stored as Cloudflare secrets. The AI fallback uses the `env.AI` Workers AI binding — no API key.

## Testing Decisions

Good tests check external behavior (inputs and observable outputs), not internal wiring. Seams reuse
the existing harness wherever possible; exactly one new seam is added.

- **Pure functions (Node built-in test runner).** Unit-test `parseTask`, `computeRemindAt`, and
  `advanceRecurring` for inputs and edge cases (relative/absolute dates, 12h/24h times, date-only →
  09:00, no-date → null, recurrence rollover, timezone correctness). Prior art: `parse.test.mjs`.
- **Backend handlers against the fake database.** Test the webhook handler and the cron run function
  against the existing fake D1, asserting the resulting database state and the outbound messages.
  Cases: capture creates the right task; forwarded message; duplicate delivery is ignored; unsigned
  request rejected; wrong sender ignored; Done marks complete; Done advances a recurring task; snooze
  reschedules the right task; cron sends due reminders once and respects the 24h-late cutoff. Prior
  art: `storage.test.mjs`, `sync.test.mjs` (both use `fakeD1.mjs`).
- **New seam — injectable WhatsApp client.** The component that calls Meta is injected so tests
  substitute a fake that records outbound messages instead of making network calls. This is the only
  new test seam.
- **One end-to-end test (Playwright).** A captured task appears in the app UI, exercising the real
  webhook → D1 → sync path in a browser. Prior art: the existing `e2e/*.spec.js` suite.

## Out of Scope

- Multi-user, team, or workspace bots; any per-user data partitioning.
- A phone-linking UI or 6-digit verification flow.
- Voice-note transcription, a daily morning agenda, and image-to-task (planned for v2).
- Multi-language replies, routing a task to a project by name, and location-based reminders.
- Refactoring the app's offset-based date model; we only add the derived `remindAt`.

## Further Notes

- External prerequisites that gate production: a Meta Business account + WhatsApp Business Account, a
  dedicated SIM not on regular WhatsApp (development uses Meta's free test number), Meta business
  verification, and one approved Utility reminder template. Start these early — verification is slow.
- Cost is per-message and tiny at personal volume (≈ ₹35/month); captures, confirmations, and snooze
  handling are free inside the 24-hour window, while reminders outside it are billed.
- To confirm at build time: exact confirmation/reminder wording and the confidence threshold that
  triggers the Haiku fallback.
- **Publishing:** the `to-prd` skill normally publishes this to the project issue tracker with a
  `ready-for-agent` label, but no tracker is configured (`/setup-matt-pocock-skills` not run). This
  PRD is saved as a file; run `/to-issues` next to split it into vertical-slice issues.
