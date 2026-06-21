# Absolute-date parsing fix — design

**Date:** 2026-06-21
**Feature:** A (of the Todoist/Any.do parity batch: A date-fix, B sub-projects, C saved filters, D Kanban, E time-blocking, F AI subtasks+voice)
**Scope:** `src/data.js` `parseTask` only, plus a new unit test file. No data-model, UI, or sync change.

## Problem

The quick-add parser (`parseTask` in `src/data.js`) mishandles tasks that mention an absolute date in the title.

### 1. Ordering bug

Time is parsed (step 5) before dates (step 6). The time matcher uses `String.match` (non-global), so it only inspects the **first** number in the string. For input `Meeting Dec 3 at 2pm`:

- The time matcher grabs the `3` from the date `Dec 3`.
- `3` has no `am/pm`, no colon, no leading `at`, so the guard rejects it and does **not** consume it.
- Because only the first match is examined, the real `2pm` is never parsed.
- Result: the `2pm` time is silently dropped.

### 2. Limited formats

Only month-then-day (`Jan 15`) is recognized. Not recognized:
- day-then-month (`15 Jan`)
- a trailing year (`Jan 15 2026`)

Full month names already work because the existing regex uses `[a-z]*` after the 3-letter stem.

## Fix

### Reorder: parse dates before time

Move the date-parsing step ahead of the time-parsing step. The date pattern matches and **removes** `Dec 3` from the working text, so the time matcher only ever sees `Meeting at 2pm`. This removes the number-collision at its root — there is no way for a date's day number to be mistaken for a time.

### Add two absolute-date patterns

Alongside the existing relative patterns (`today`, `tomorrow`, `next week`, `in N days`, `next <weekday>`), support:

- **month-then-day**: `Jan 15`, `January 15`, with optional `, 2026` or ` 2026`
- **day-then-month**: `15 Jan`, `15 January`, with optional ` 2026`

The optional year is captured and consumed as part of the date match, so a stray `2026` cannot leak into the time matcher either.

### Year handling

- If a year is typed, use it.
- If no year is typed, keep the current behaviour: assume the current year, and if that date has already passed, roll to next year.

## Out of scope (deliberate)

- Numeric slash dates (`15/01`, `01/15`) — ambiguous between US (month/day) and rest-of-world (day/month) formats; needs a locale setting we are not adding now.
- ISO dates (`2026-01-15`) — not requested.
- Relative dates, recurring, priority, project, label parsing — untouched.

## Testing

`parseTask` is pure logic in one function, so this is fixed test-first. New unit test file covering:

- **Bug case:** `Meeting Dec 3 at 2pm` → due offset for Dec 3 **and** `time === '14:00'`.
- **Day-first:** `Submit 15 Jan` → Jan 15.
- **Year:** `Jan 15 2026` → year 2026 used.
- **Day-first full name:** `Pay rent 1 March` → Mar 1.
- **Regression guard:** existing relative cases (`tomorrow`, `next Monday`, `in 3 days`, `daily`) still parse as before.

## Acceptance

- `Meeting Dec 3 at 2pm` yields both the correct date and `14:00`.
- All four new absolute-date shapes parse.
- No existing relative-date test regresses.
