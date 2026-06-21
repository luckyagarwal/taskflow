# Absolute-Date Parsing Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the quick-add parser so absolute dates in a task title parse correctly, including when a time follows the date, and add day-first and explicit-year date formats.

**Architecture:** Pure-logic change inside one function, `parseTask` in `src/data.js`. Two moves: (1) reorder so dates parse *before* time — this removes the number-collision that drops the time; (2) expand the date patterns to also accept `15 Jan` (day-first) and a trailing year. Test-first, using the existing Node test runner.

**Tech Stack:** Plain ES modules, Node built-in test runner (`node:test` + `node:assert/strict`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-21-absolute-date-parsing-fix-design.md`

---

## File Structure

- **Modify:** `src/data.js` — `parseTask` only. Move the date-parsing block above the time-parsing block (Task 1); expand `datePatterns` with two absolute formats and a year-aware helper (Task 2).
- **Modify:** `tests/parse.test.mjs` — add the import of `offsetFromDate`, then add new tests (Task 1 bug test, Task 2 format tests). Existing tests are the regression guard and must keep passing.

No other files change. No data-model, UI, or sync change.

---

## Task 1: Reorder — parse dates before time (fixes the ordering bug)

**Files:**
- Modify: `tests/parse.test.mjs`
- Modify: `src/data.js` (the time block + date block inside `parseTask`, currently steps "5. Parse Time" and "6. Parse Dates")

The existing parser already recognizes `Dec 3` (month-then-day). The bug is purely ordering: time is parsed first and the time matcher grabs the date's day number. Moving date-parsing ahead of time-parsing fixes it with no new patterns.

- [ ] **Step 1: Add `offsetFromDate` to the test import**

In `tests/parse.test.mjs`, change line 3 from:

```js
import { parseTask } from "../src/data.js";
```

to:

```js
import { parseTask, offsetFromDate } from "../src/data.js";
```

- [ ] **Step 2: Write the failing bug test**

Append to `tests/parse.test.mjs`:

```js
test("absolute date + trailing time both parse (ordering bug)", () => {
  const r = P("Meeting Dec 3 at 2pm");
  assert.equal(r.content, "Meeting");
  assert.equal(r.time, "14:00");
  // Dec 3 of this year, or next year if it already passed.
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 11, 3);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 11, 3);
  assert.equal(r.dueOffset, offsetFromDate(target));
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/parse.test.mjs`
Expected: the new test FAILS — `r.time` is `null` (the `2pm` was dropped) instead of `"14:00"`.

- [ ] **Step 4: Reorder the date and time blocks in `parseTask`**

In `src/data.js`, replace the entire region starting at the comment `// 5. Parse Time:` through the end of the date-parsing `for` loop (the loop that ends just before `const content = text.replace(...)`) with the following — note the date block now comes first and the comment numbers are swapped:

```js
  // 5. Parse Dates (Relative/Calendar) — BEFORE time so a date's day number
  //    can't be mis-grabbed by the time matcher.
  const today = new Date();
  const datePatterns = [
    { regex: /\btoday\b/i, off: 0 },
    { regex: /\btomorrow\b/i, off: 1 },
    { regex: /\bthis\s+weekend\b/i, off: (() => {
        const d = today.getDay();
        return ((6 - d) + 7) % 7 || 6;
      })()
    },
    { regex: /\bnext\s+week\b/i, off: 7 },
    { regex: /\bin\s+(\d+)\s+days?\b/i, parser: (m) => parseInt(m[1]) },
    { regex: /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, parser: (m) => {
        const dows = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDow = dows.indexOf(m[1].toLowerCase());
        const currentDow = today.getDay();
        let diff = targetDow - currentDow;
        if (diff <= 0) diff += 7;
        return diff;
      }
    },
    { regex: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i, parser: (m) => {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const month = monthNames.indexOf(m[1].toLowerCase().substring(0, 3));
        const day = parseInt(m[2]);
        let year = today.getFullYear();
        let targetDate = new Date(year, month, day);
        if (targetDate.getTime() < today.getTime() - 86400000) {
          targetDate.setFullYear(year + 1);
        }
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.round((targetDate.getTime() - todayZero.getTime()) / MS_DAY);
      }
    }
  ];

  for (const dp of datePatterns) {
    const m = text.match(dp.regex);
    if (m) {
      dueOffset = dp.off !== undefined ? dp.off : dp.parser(m);
      text = text.replace(dp.regex, '');
      break;
    }
  }

  // 6. Parse Time: "at 5pm", "5:30pm", "at 17:00", "9am" — AFTER dates.
  const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    const mm = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3];
    const hasAt = /\bat\s+\d/i.test(timeMatch[0]);
    const hasAmpm = !!ampm;
    const hasColon = !!timeMatch[2];
    if (hasAt || hasAmpm || hasColon) {
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && h < 12) h += 12;
        if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
      }
      if (h >= 0 && h < 24 && mm >= 0 && mm < 60) {
        time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        text = text.replace(timeRegex, '');
      }
    }
  }
```

(The original step-5 time block declared minutes as `const m`; it is renamed to `mm` here only to read clearly — behaviour is identical.)

- [ ] **Step 5: Run the tests to verify all pass**

Run: `node --test tests/parse.test.mjs`
Expected: PASS — the new bug test passes, and all six existing tests still pass (the relative-date + time test `Call mom tomorrow at 5pm` is the key regression check; it works because `tomorrow` is removed before time parsing).

- [ ] **Step 6: Commit**

```bash
git add src/data.js tests/parse.test.mjs
git commit -m "fix(parse): parse dates before time so trailing time isn't dropped

A date's day number was grabbed by the time matcher first, so a real
time after an absolute date (e.g. 'Dec 3 at 2pm') was silently lost.
Parse dates before time to remove the collision.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add day-first and explicit-year absolute date formats

**Files:**
- Modify: `tests/parse.test.mjs`
- Modify: `src/data.js` (the `datePatterns` setup inside `parseTask`, as left by Task 1)

Add `15 Jan` (day-then-month) and a trailing year (`Jan 15 2026`, `15 Jan 2026`). Refactor the offset math into one shared helper so both month-first and day-first share it.

- [ ] **Step 1: Write the failing format tests**

Append to `tests/parse.test.mjs`:

```js
test("day-first absolute date: 15 Jan", () => {
  const r = P("Submit report 15 Jan");
  assert.equal(r.content, "Submit report");
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 0, 15);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 0, 15);
  assert.equal(r.dueOffset, offsetFromDate(target));
});

test("day-first full month name: 1 March", () => {
  const r = P("Pay rent 1 March");
  assert.equal(r.content, "Pay rent");
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), 2, 1);
  if (target < todayZero) target = new Date(now.getFullYear() + 1, 2, 1);
  assert.equal(r.dueOffset, offsetFromDate(target));
});

test("explicit year is honoured: Jan 15 2030", () => {
  const r = P("Launch Jan 15 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});

test("day-first with explicit year: 15 Jan 2030", () => {
  const r = P("Launch 15 Jan 2030");
  assert.equal(r.content, "Launch");
  assert.equal(r.dueOffset, offsetFromDate(new Date(2030, 0, 15)));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/parse.test.mjs`
Expected: the four new tests FAIL — day-first inputs produce `dueOffset === null` (no pattern matches), and the explicit-year inputs ignore the year (`Jan 15 2030` matches the old month-day pattern, drops `2030`, and rolls to this/next year).

- [ ] **Step 3: Expand the date patterns**

In `src/data.js`, replace the date-block setup (from `const today = new Date();` through the closing `];` of the `datePatterns` array, leaving the `for` loop and the time block untouched) with:

```js
  const today = new Date();
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const MONTH_STEMS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // Offset (in days from today) for an absolute month/day, honouring an
  // explicit year; with no year, assume this year and roll forward if it passed.
  const absDateOffset = (monthIdx, day, yearStr) => {
    const year = yearStr ? parseInt(yearStr) : today.getFullYear();
    const target = new Date(year, monthIdx, day);
    if (!yearStr && target.getTime() < todayZero.getTime()) {
      target.setFullYear(year + 1);
    }
    return Math.round((target.getTime() - todayZero.getTime()) / MS_DAY);
  };

  const datePatterns = [
    { regex: /\btoday\b/i, off: 0 },
    { regex: /\btomorrow\b/i, off: 1 },
    { regex: /\bthis\s+weekend\b/i, off: (() => {
        const d = today.getDay();
        return ((6 - d) + 7) % 7 || 6;
      })()
    },
    { regex: /\bnext\s+week\b/i, off: 7 },
    { regex: /\bin\s+(\d+)\s+days?\b/i, parser: (m) => parseInt(m[1]) },
    { regex: /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, parser: (m) => {
        const dows = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDow = dows.indexOf(m[1].toLowerCase());
        const currentDow = today.getDay();
        let diff = targetDow - currentDow;
        if (diff <= 0) diff += 7;
        return diff;
      }
    },
    // month-then-day: "Jan 15", "January 15", optional ", 2026" / " 2026"
    { regex: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
      parser: (m) => absDateOffset(MONTH_STEMS.indexOf(m[1].toLowerCase().substring(0, 3)), parseInt(m[2]), m[3])
    },
    // day-then-month: "15 Jan", "15 January", optional " 2026"
    { regex: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}))?\b/i,
      parser: (m) => absDateOffset(MONTH_STEMS.indexOf(m[2].toLowerCase().substring(0, 3)), parseInt(m[1]), m[3])
    }
  ];
```

Note: month-then-day is listed before day-then-month. For `15 Jan`, month-then-day cannot match (no digits follow the month), so day-then-month handles it — no conflict.

- [ ] **Step 4: Run the tests to verify all pass**

Run: `node --test tests/parse.test.mjs`
Expected: PASS — all four new format tests pass, the Task 1 bug test still passes (the `2026`-less `Dec 3 at 2pm` still works), and all six original tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data.js tests/parse.test.mjs
git commit -m "feat(parse): support day-first and explicit-year absolute dates

Add '15 Jan' day-first parsing and an optional trailing year
('Jan 15 2026', '15 Jan 2026'). Share offset math via absDateOffset.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Ordering bug fixed → Task 1 (reorder, bug test). ✓
- Month-then-day, day-then-month, full names, trailing year → Task 2 (two patterns + tests). ✓
- Year handling (explicit honoured; otherwise this-year-then-roll) → `absDateOffset` in Task 2. ✓
- Relative dates / recurring / priority / project / label untouched → only the date+time region changes; existing tests guard relatives. ✓
- Numeric slash and ISO dates excluded → no such pattern added. ✓
- Tests listed in spec (bug case, day-first, year, full-name day-first, regression) → all present. ✓

**Placeholder scan:** none — every step has full code and exact commands.

**Type/name consistency:** `absDateOffset(monthIdx, day, yearStr)` defined and called consistently in both Task 2 patterns. `MONTH_STEMS` and `todayZero` defined once, used in the helper. Minutes variable `mm` used consistently in the time block. Test helper `P` and import of `offsetFromDate` match usage.

**Note for the implementer:** This is a build artifact — `dist/` is generated by `npm run build`. This change is source-only (`src/data.js`); rebuild/deploy is handled separately and is out of scope for these two commits.
