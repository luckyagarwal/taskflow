// shared/compute.js — the single source of truth for task parsing and reminder
// timing, imported by the frontend (src/), the webhook (functions/), and the
// reminder cron worker. Keeping all three on one module guarantees they agree on
// how a sentence becomes a task and when a reminder fires (see ADR 0001).
//
// Pure ESM, no DOM or React, no Node built-ins, no dependencies — safe to import
// from a browser bundle, a Cloudflare Pages Function, and a Cloudflare Worker.

export const MS_DAY = 86400000;

// Fixed app timezone for reminder math: Asia/Kolkata is UTC+05:30 with no DST,
// so a single constant offset is exact (see ADR 0001 — single-user, hardcoded tz).
export const APP_TZ_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// Default reminder time for a task that has a date but no explicit time: 09:00.
export const DEFAULT_REMIND_MINUTES = 9 * 60;

// ── Relative-offset date helpers (browser-local, UI source of truth) ─────────

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// date from an offset in days relative to today (0 = today)
export function dateFromOffset(off) {
  if (off === null || off === undefined || off === 'someday') return null;
  return new Date(startOfToday().getTime() + off * MS_DAY);
}

export function offsetFromDate(date) {
  if (!date) return null;
  const a = startOfToday().getTime();
  const b = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((b - a) / MS_DAY);
}

// ── computeRemindAt — the absolute instant a reminder should fire ────────────

// Resolve a relative dueOffset (+ optional "HH:MM" time) to an absolute epoch-ms
// instant in the fixed app timezone (Asia/Kolkata). Returns null for a task with
// no due date. `now` is injectable for deterministic tests; it defaults to the
// current time. A date-only task fires at 09:00 IST.
export function computeRemindAt(dueOffset, time, now = Date.now()) {
  if (dueOffset === null || dueOffset === undefined || dueOffset === 'someday') {
    return null;
  }
  // Midnight-today in IST, expressed as a UTC epoch. Shift into IST, floor to the
  // IST day, then shift back so the day boundary is IST's, not the server's.
  const istNow = now + APP_TZ_OFFSET_MS;
  const istMidnightToday = Math.floor(istNow / MS_DAY) * MS_DAY - APP_TZ_OFFSET_MS;

  const minutes = parseTimeToMinutes(time);
  return istMidnightToday + dueOffset * MS_DAY + minutes * 60 * 1000;
}

// "HH:MM" -> minutes past midnight; null/invalid -> the 09:00 default.
function parseTimeToMinutes(time) {
  if (typeof time !== 'string') return DEFAULT_REMIND_MINUTES;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return DEFAULT_REMIND_MINUTES;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return DEFAULT_REMIND_MINUTES;
  return h * 60 + mm;
}

// ── parseTask — plain language → structured task fields ──────────────────────

export function parseTask(raw, projects = [], existingLabels = []) {
  let text = raw;
  let priority = 4;
  let dueOffset = null;
  let time = null;
  let projectId = null;
  let taskLabels = [];
  let recurring = null;

  // 1. Parse Priority: p1 to p4
  const prioRegex = /\bp([1-4])\b/i;
  const prioMatch = text.match(prioRegex);
  if (prioMatch) {
    priority = parseInt(prioMatch[1]);
    text = text.replace(prioRegex, '');
  }

  // 2. Parse Project: #Work (starts with #, matches word)
  const projRegex = /#(\w+)/;
  const projMatch = text.match(projRegex);
  if (projMatch) {
    const projName = projMatch[1];
    const matchProj = projects.find(p => p.name.toLowerCase() === projName.toLowerCase());
    if (matchProj) {
      projectId = matchProj.id;
    } else {
      projectId = '__new__' + projName;
    }
    text = text.replace(projRegex, '');
  }

  // 3. Parse Tags: @tag (starts with @, matches word)
  const tagRegex = /@(\w+)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(text)) !== null) {
    const tagName = tagMatch[1];
    const matchLabel = existingLabels.find(l => l.name.toLowerCase() === tagName.toLowerCase());
    if (matchLabel) {
      if (!taskLabels.includes(matchLabel.id)) taskLabels.push(matchLabel.id);
    } else {
      taskLabels.push('__new__' + tagName);
    }
  }
  text = text.replace(tagRegex, '');

  // 4. Parse Recurrence
  const recurPatterns = [
    { regex: /\bevery\s+day\b/i, rule: { type: 'day' } },
    { regex: /\bdaily\b/i, rule: { type: 'day' } },
    { regex: /\bevery\s+week\b/i, rule: { type: 'week' } },
    { regex: /\bweekly\b/i, rule: { type: 'week' } },
    { regex: /\bevery\s+month\b/i, rule: { type: 'month' } },
    { regex: /\bmonthly\b/i, rule: { type: 'month' } },
    { regex: /\bevery\s+year\b/i, rule: { type: 'year' } },
    { regex: /\byearly\b/i, rule: { type: 'year' } },
    { regex: /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, parser: (m) => {
        const dows = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dow = dows.indexOf(m[1].toLowerCase());
        return { type: 'weekday', dow };
      }
    }
  ];

  for (const p of recurPatterns) {
    const m = text.match(p.regex);
    if (m) {
      recurring = p.rule || p.parser(m);
      text = text.replace(p.regex, '');
      break;
    }
  }

  // 5. Parse Dates (Relative/Calendar) — BEFORE time so a date's day number
  //    can't be mis-grabbed by the time matcher.
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
    // bare weekday: "thursday", "on thursday" — nearest upcoming, today included.
    // MUST stay after "next <weekday>" so that pattern matches first.
    { regex: /\b(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, parser: (m) => {
        const dows = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDow = dows.indexOf(m[1].toLowerCase());
        let diff = targetDow - today.getDay();
        if (diff < 0) diff += 7;
        return diff;
      }
    },
    // month-then-day: "Jan 15", "January 15", optional ", 2026" / " 2026"
    { regex: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
      parser: (m) => absDateOffset(MONTH_STEMS.indexOf(m[1].toLowerCase().substring(0, 3)), parseInt(m[2]), m[3])
    },
    // day-then-month: "15 Jan", "15 January", optional ", 2026" / " 2026"
    { regex: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:,?\s+(\d{4}))?\b/i,
      parser: (m) => absDateOffset(MONTH_STEMS.indexOf(m[2].toLowerCase().substring(0, 3)), parseInt(m[1]), m[3])
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

  const content = text.replace(/\s+/g, ' ').trim();
  return {
    content: content || 'Untitled',
    dueOffset,
    time,
    priority,
    projectId,
    labels: taskLabels,
    recurring
  };
}

// ── advanceRecurring — roll a recurring task to its next occurrence ──────────

export function advanceRecurring(dueOffset, rule) {
  if (!rule) return null;
  const today = startOfToday();
  const currentDue = dateFromOffset(dueOffset) || today;
  let nextDue = new Date(currentDue);

  const step = () => {
    if (rule.type === 'day') {
      nextDue.setDate(nextDue.getDate() + 1);
    } else if (rule.type === 'week') {
      nextDue.setDate(nextDue.getDate() + 7);
    } else if (rule.type === 'month') {
      nextDue.setMonth(nextDue.getMonth() + 1);
    } else if (rule.type === 'year') {
      nextDue.setFullYear(nextDue.getFullYear() + 1);
    } else if (rule.type === 'weekday') {
      const targetDow = rule.dow;
      do {
        nextDue.setDate(nextDue.getDate() + 1);
      } while (nextDue.getDay() !== targetDow);
    }
  };

  let iterations = 0;
  do {
    step();
    iterations++;
  } while (nextDue.getTime() < today.getTime() && iterations < 365);

  return offsetFromDate(nextDue);
}

// ── withRemindAt — maintain remindAt/reminderSent on a task record ───────────

// Return a copy of `task` with `remindAt` recomputed from its dueOffset + time.
// `reminderSent` is reset to false only when remindAt actually changes, so an
// unrelated edit (e.g. renaming the task) never re-arms a reminder that already
// fired. The single place every writer should funnel a dated task through.
export function withRemindAt(task, now = Date.now()) {
  if (!task) return task;
  const remindAt = computeRemindAt(task.dueOffset, task.time, now);
  const prev = task.remindAt === undefined ? null : task.remindAt;
  const changed = remindAt !== prev;
  return {
    ...task,
    remindAt,
    reminderSent: changed ? false : (task.reminderSent ?? false),
  };
}
