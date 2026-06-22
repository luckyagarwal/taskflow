# TaskFlow × WhatsApp Integration — Plan

> Status: **Grilled.** Open questions resolved (see Decisions). Next step: `/to-prd` → `/to-issues`.
> Goal: create and receive TaskFlow tasks and reminders inside WhatsApp, Any.do-style, for a single user.
> Related: glossary in [`CONTEXT.md`](../CONTEXT.md); date-model decision in [ADR 0001](adr/0001-absolute-remindat-alongside-offsets.md).

---

## Decisions (resolved in grilling)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Tenancy | **Single user, forever.** Backend confirmed single-tenant (no per-user data). |
| 2 | Reminder timing | **Absolute `remindAt`** (epoch ms) computed in fixed TZ Asia/Kolkata; cron reads it. See ADR 0001. |
| 3 | Date-only tasks | Remind at **9:00 AM** on the due day. No due date → no reminder. |
| 4 | Provider | **Meta WhatsApp Cloud API (direct)**, no reseller. |
| 5 | Phone number | **Spare SIM** for production; **Meta test number** for development. |
| 6 | v1 scope | **Capture + reminders + Done button + snooze-by-reply**, with Haiku parser fallback. |
| 7 | Recurring + Done | **Advance to next occurrence server-side** (port `advanceRecurring`), recompute `remindAt`. |
| 8 | Snooze | **Done** button + **reply with a natural-language time** → reparse → new `remindAt`. Track "last reminder context". |
| 9 | Parser | **`parseTask()` (regex) + Claude Haiku fallback** on low confidence. Extract `parseTask` to a shared module. |
| 10 | App-created tasks | **All dated tasks remind** — frontend computes `remindAt` on save; backfill existing tasks. |
| 11 | Go-live backfill | **Mark existing past-due tasks already-sent** so no flood. Steady-state grace window ~24h. |
| 12 | Linking | **No link flow.** Hardcode the allowed number as a secret (`WA_ALLOWED_NUMBER`). No `wa_links` table, no settings UI. |

**Forced technical constraints (not choices):**
- Cloudflare **Pages Functions cannot run cron** → the reminder scheduler is a **separate Cloudflare Worker** bound to the same D1.
- **No D1 schema change** → tasks are JSON blobs; `remindAt`/`reminderSent` are new JSON fields. Cron scans all non-deleted tasks each run (fine for one user).
- Webhook **must** be excluded from Cloudflare Access and secured by Meta signature verification.

---

## 1. What Any.do's WhatsApp integration does (research)

### Inbound (user → bot)
- **Plain text → task** ("Remind me to buy milk at 5pm").
- **Multiple tasks** in one message, each created separately.
- **Forwarded messages** become tasks with no command.
- **Voice notes** via the phone's voice-to-text keyboard (Any.do does **not** transcribe a native voice attachment server-side — a gap we can beat).
- **Images / files** as attachments (workspace bot).
- Natural-language dates: relative (`in 3 days`), absolute (`January 8 at 11:00`), 12h/24h. Rejects ambiguous formats.

### Outbound (bot → user)
- **Reminders delivered in WhatsApp** at due time.
- **Snooze / mark complete** from the message.
- Recurring reminders show in WhatsApp but must be created/completed in the app to advance.

### Account / commercial
- Setup: Settings → Integrations → WhatsApp → number + **6-digit code**. One number per account. Separate Personal vs Workspace bots.
- ~16–29 input languages; replies always in English; device timezone.
- **Paid only** (Premium $2.99/mo, Family, Workspace). Geo-blocked in some countries.

*(Sources at the bottom.)*

---

## 2. Scope

TaskFlow is single-user → we mirror Any.do's **Personal bot** only.

### v1 — capture + remind (the core loop)
1. **Text / forwarded message → task**, parsed (regex + Haiku fallback), with a confirmation reply ("✅ Added: Buy milk — tomorrow 9:00 AM").
2. **Reminders in WhatsApp** at `remindAt` (timed tasks at their time; date-only at 9 AM).
3. **Done** button → mark complete; for recurring, advance to next occurrence.
4. **Snooze** → reply with any time phrase ("in 2 hours", "tomorrow 8am") → reschedules `remindAt`.
5. Reminders fire for **all dated tasks** (app- or bot-created).

### v2 — smarter capture
6. **Voice-note transcription** server-side (beats Any.do): download audio → speech-to-text → parse.
7. **Daily morning agenda** ("Here's your day: 3 tasks…").
8. **Image → task** with the image as a note attachment.

### Later
- Multi-language replies, list/project routing by name, location reminders.

---

## 3. Technical design

### 3.1 WhatsApp access
- **Meta Business account + WhatsApp Business Account (WABA)**.
- **WhatsApp Cloud API** (Meta-hosted, free to use; pay per message).
- **Dedicated number** (spare SIM) not on normal WhatsApp; dev uses Meta's **test number** first.
- **Business verification** by Meta (slow; test number unblocks dev meanwhile).
- One approved **Utility template** for reminders sent outside the 24-hour window.

### 3.2 Webhook + security
- New `POST /api/whatsapp` (Pages Function). `GET` handles the verify handshake (verify token); `POST` **must** verify `X-Hub-Signature-256` (HMAC-SHA256 of body with the Meta app secret) and reject mismatches.
- **Cloudflare Access bypass** for `/api/whatsapp` so Meta can reach it. Signature check is the only gate — mandatory.
- Accept only messages from `WA_ALLOWED_NUMBER`; ignore all others.
- Dedupe by WhatsApp message id (Meta retries) to avoid double-capture.
- Reply `200` fast; do work after acknowledging.

### 3.3 The 24-hour window (drives cost)
- Messages **within 24h** of the user's last message: free-form, **free** (captures, confirmations, snooze handling).
- Messages **outside** it (most reminders): require the approved **Utility template**, **billed per message**.

### 3.4 Reminder scheduler (separate Worker)
- A standalone **Cloudflare Worker** with a **Cron Trigger every 1 minute**, bound to the same D1.
- Each run: read all non-deleted tasks, select `remindAt <= now AND !reminderSent AND remindAt > now − 24h`, send the reminder template, set `reminderSent`.
- Recurring **Done** (from the webhook) and **snooze** both recompute `remindAt` and clear `reminderSent`.

### 3.5 Writing tasks (reuse the sync engine)
- Webhook builds a task object identical to the UI's and writes it via the **same upsert + last-write-wins** logic as `/api/save` (extract that into a shared helper).
- Existing **SSE tickle + 15s polling** surfaces the new task in an open tab in ~2s. No new realtime code.
- Existing **LWW / tombstones** handle app-vs-bot edit conflicts.

### 3.6 Shared parsing + remindAt
- Extract `parseTask()` and a new `computeRemindAt(offset, time, tz)` into a **shared module** imported by the frontend, the webhook, and the cron worker — one source of truth.
- Webhook parsing: try regex; if low confidence, call **Claude Haiku** (`ANTHROPIC_API_KEY`) to produce `{title, dueOffset, time, priority, labels}`.

### 3.7 Snooze / last-reminder context
- The bot stores which task the last reminder was about (small state in D1 or meta), so a bare time-phrase reply reschedules the right task.

---

## 4. Codebase changes

### New
| File | Purpose |
|------|---------|
| `functions/api/whatsapp.js` | Webhook: GET verify; POST signature-check → dedupe → allowed-number check → route (capture / button action / snooze reply) → reply. |
| `functions/lib/whatsapp.js` | Cloud API client: send text / send template / interactive buttons / download media. |
| `functions/lib/wa-auth.js` | `X-Hub-Signature-256` + verify-token checks. |
| `functions/lib/write.js` | Shared upsert/LWW write extracted from `save.js`. |
| `shared/parse.js` | `parseTask()` + `computeRemindAt()` (imported by `src/` and `functions/`). |
| `worker-reminders/` (new Worker) | Cron-triggered reminder scheduler bound to D1. Its own `wrangler.toml` with `[triggers] crons = ["* * * * *"]`. |

### Changed
| File | Change |
|------|--------|
| `functions/api/save.js` | Use shared `write.js`. |
| `src/store.jsx` | Compute `remindAt` on every dated-task save; recompute on recurring advance; backfill existing tasks (mark past-due `reminderSent`). |
| `src/data.js` | Move `parseTask`/`advanceRecurring` into `shared/parse.js` (re-export for the app). |
| `wrangler.toml` (Pages) | Add secrets bindings: `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, `WA_ALLOWED_NUMBER`, `ANTHROPIC_API_KEY`. |
| Cloudflare Access config | Bypass policy for `/api/whatsapp`. |

### Reused unchanged
- `src/sync.js`, `src/repo.js`, `src/db.js`, SSE tickle, D1 schema.

---

## 5. Cost (per-message pricing; verify current Meta rates)

- **Cloud API:** free to use. **Cloudflare** webhook + cron + D1: free tier.
- **Captures / confirmations / snooze:** free (inside 24h window).
- **Reminders:** Utility template, billed. India ≈ **₹0.115 (~$0.0014)** each; US ≈ $0.04 each.
- **You, personally:** ~10 reminders/day → **~₹35/month**. Effectively free.
- **Haiku fallback:** ~fraction of a cent per parsed message → negligible.
- Cost scales with reminder volume and recipient region, **not** infrastructure.

---

## 6. Remaining risks
1. **Meta business verification** latency (days) — start early; dev on test number.
2. **Template approval** must land before production reminders work.
3. **Every date-writer must maintain `remindAt`** (frontend, webhook, recurring) — a missed one = stale reminder. Shared function + tests mitigate.
4. **Public webhook** — signature verification is non-negotiable.
5. **Dedicated SIM** sourcing for production.

---

## 7. Roadmap
- **Phase 0 (external, now):** Meta Business + WABA, test number, draft Utility template, plan SIM.
- **Phase 1 (v1):** shared module + `remindAt`; webhook + security; capture + Haiku fallback; reminder Worker + cron; Done/recurring-advance; snooze-by-reply; backfill migration.
- **Phase 2:** voice transcription, daily agenda, image → task.
- **Phase 3:** multi-language, project routing, location reminders.

---

## 8. Next step
`/to-prd` to convert this into a PRD, then `/to-issues` to split into independent issues
(suggested: *shared module + remindAt*, *webhook + security*, *capture + Haiku*, *reminder Worker + cron*, *Done + recurring + snooze*, *backfill migration*). Then `/implement` each in a fresh session.

---

## Sources
- Any.do Help Center — WhatsApp Reminders & Tasks: https://support.any.do/en/articles/8616832-any-do-whatsapp-reminders-tasks
- Any.do WhatsApp landing page: https://whatsapp.any.do/
- Android Authority: https://www.androidauthority.com/whatsapp-reminders-tasks-anydo-1063582/
- XDA Developers: https://www.xda-developers.com/whatsapp-gets-any-do-integration-tasks-reminders-adds-call-waiting-support/
- Android Central: https://www.androidcentral.com/whatsapp-can-now-set-reminders-thanks-anydo-integration
