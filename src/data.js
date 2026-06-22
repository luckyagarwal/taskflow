// data.js — sample content + date helpers for the Todo prototype

export const MS_DAY = 86400000;

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

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Human label for a due date given its offset
export function dueLabel(off) {
  if (off === null || off === undefined) return null;
  if (off === 'someday') return { text: 'Someday', tone: 'future' };
  const d = dateFromOffset(off);
  if (!d) return null;
  if (off < 0) {
    if (off === -1) return { text: 'Yesterday', tone: 'overdue' };
    if (off > -7) return { text: DOW_LONG[d.getDay()], tone: 'overdue' };
    return { text: `${d.getDate()} ${MONTHS[d.getMonth()]}`, tone: 'overdue' };
  }
  if (off === 0) return { text: 'Today', tone: 'today' };
  if (off === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (off < 7) return { text: DOW_LONG[d.getDay()], tone: 'soon' };
  return { text: `${d.getDate()} ${MONTHS[d.getMonth()]}`, tone: 'future' };
}

// ── Labels ───────────────────────────────────────────────────
export const labels = [
  { id: 'l_deep', name: 'deep work', color: '#7C5CFC' },
  { id: 'l_quick', name: 'quick win', color: '#1F9D55' },
  { id: 'l_errand', name: 'errand', color: '#F5A623' },
  { id: 'l_waiting', name: 'waiting', color: '#9AA0A6' },
  { id: 'l_email', name: 'email', color: '#2D7FF9' },
  { id: 'l_call', name: 'call', color: '#E8588A' },
];

// ── Projects (areas via `group`, nesting via `parent`) ───────
export const projects = [
  { id: 'p_launch',  name: 'Q3 Product Launch', color: '#2D7FF9', group: 'Work', parent: null },
  { id: 'p_mktg',    name: 'Marketing Site',    color: '#7C5CFC', group: 'Work', parent: null },
  { id: 'p_hiring',  name: 'Hiring',            color: '#14B8C4', group: 'Work', parent: null },
  { id: 'p_home',    name: 'Home & Errands',    color: '#1F9D55', group: 'Personal', parent: null },
  { id: 'p_health',  name: 'Health & Fitness',  color: '#E8588A', group: 'Personal', parent: null },
  { id: 'p_read',    name: 'Reading List',      color: '#F5A623', group: 'Personal', parent: null },
];

// ── Tasks ────────────────────────────────────────────────────
let _id = 0;
const t = (o) => Object.assign({ id: 'task_' + (++_id), note: '', time: null, priority: 4, labels: [], subtasks: [], done: false, doneOffset: null, createdAt: Date.now() - (100 - _id) * 60000 }, o);

export const tasks = [
  // ── Overdue ──
  t({ title: 'Send sponsor deck to Northwind', projectId: 'p_launch', dueOffset: -2, priority: 1, labels: ['l_email'], note: 'They asked for the v3 numbers and the updated timeline slide.' }),
  t({ title: 'Reply to recruiter about onsite dates', projectId: 'p_hiring', dueOffset: -1, priority: 2, labels: ['l_email', 'l_waiting'] }),
  t({ title: 'Renew gym membership', projectId: 'p_health', dueOffset: -1, priority: 3, labels: ['l_errand'] }),

  // ── Today ──
  t({ title: 'Finalize launch run-of-show', projectId: 'p_launch', dueOffset: 0, time: '09:30', priority: 1, labels: ['l_deep'],
      note: 'Lock the minute-by-minute for launch morning. Confirm who is on stage.',
      subtasks: [
        { id: 's1', title: 'Confirm keynote order', done: true },
        { id: 's2', title: 'Demo backup plan', done: true },
        { id: 's3', title: 'Green-room schedule', done: false },
        { id: 's4', title: 'AV walkthrough booked', done: false },
      ] }),
  t({ title: 'Review homepage hero copy', projectId: 'p_mktg', dueOffset: 0, time: '11:00', priority: 2, labels: ['l_deep'],
      subtasks: [
        { id: 's1', title: 'Headline options', done: true },
        { id: 's2', title: 'Sub-head + CTA', done: false },
      ] }),
  t({ title: 'Stand-up with eng', projectId: 'p_launch', dueOffset: 0, time: '14:00', priority: 3, labels: ['l_call'] }),
  t({ title: 'Pick up dry cleaning', projectId: 'p_home', dueOffset: 0, priority: 4, labels: ['l_errand', 'l_quick'] }),
  t({ title: 'Water the plants', projectId: 'p_home', dueOffset: 0, priority: 4, labels: ['l_quick'] }),
  t({ title: '30-min mobility session', projectId: 'p_health', dueOffset: 0, time: '18:00', priority: 4 }),

  // ── Tomorrow ──
  t({ title: 'Draft Q3 launch press release', projectId: 'p_launch', dueOffset: 1, priority: 2, labels: ['l_deep'],
      subtasks: [{ id: 's1', title: 'Quote from CEO', done: false }, { id: 's2', title: 'Boilerplate', done: false }] }),
  t({ title: 'Interview: Senior Designer', projectId: 'p_hiring', dueOffset: 1, time: '15:30', priority: 1, labels: ['l_call'] }),
  t({ title: 'Order standing desk mat', projectId: 'p_home', dueOffset: 1, priority: 4, labels: ['l_errand'] }),

  // ── Upcoming (this week) ──
  t({ title: 'Marketing site QA pass', projectId: 'p_mktg', dueOffset: 2, priority: 2, labels: ['l_deep'] }),
  t({ title: 'Book flights for offsite', projectId: 'p_home', dueOffset: 3, priority: 3, labels: ['l_errand'] }),
  t({ title: 'Meal prep for the week', projectId: 'p_health', dueOffset: 3, priority: 4 }),
  t({ title: 'Finish “Shape Up” ch. 4–6', projectId: 'p_read', dueOffset: 4, priority: 4, labels: ['l_deep'] }),
  t({ title: 'Send launch invites', projectId: 'p_launch', dueOffset: 5, priority: 2, labels: ['l_email'] }),

  // ── Later ──
  t({ title: 'Plan Q4 roadmap workshop', projectId: 'p_launch', dueOffset: 9, priority: 3, labels: ['l_deep'] }),
  t({ title: 'Quarterly dentist checkup', projectId: 'p_health', dueOffset: 12, priority: 4, labels: ['l_call'] }),

  // ── Inbox (no project, no date) ──
  t({ title: 'Idea: weekly “show & tell” for the team', projectId: 'inbox', dueOffset: null, priority: 4 }),
  t({ title: 'Look into noise-cancelling headphones', projectId: 'inbox', dueOffset: null, priority: 4, labels: ['l_errand'] }),
  t({ title: 'Read up on the new design tokens spec', projectId: 'inbox', dueOffset: null, priority: 4, labels: ['l_read'] }),

  // ── No date but in projects (Anytime) ──
  t({ title: 'Refresh the brand color palette', projectId: 'p_mktg', dueOffset: null, priority: 3, labels: ['l_deep'] }),
  t({ title: 'Backlog grooming', projectId: 'p_launch', dueOffset: null, priority: 4 }),
  t({ title: 'Try the new ramen place', projectId: 'p_home', dueOffset: null, priority: 4, labels: ['l_errand'] }),

  // ── Completed (logbook) ──
  t({ title: 'Ship pricing page update', projectId: 'p_mktg', dueOffset: -1, priority: 2, done: true, doneOffset: 0 }),
  t({ title: 'Approve new offer letter template', projectId: 'p_hiring', dueOffset: -1, priority: 3, done: true, doneOffset: 0 }),
  t({ title: 'Morning run — 5k', projectId: 'p_health', dueOffset: 0, priority: 4, done: true, doneOffset: 0 }),
  t({ title: 'Pay electricity bill', projectId: 'p_home', dueOffset: -2, priority: 2, done: true, doneOffset: -1, labels: ['l_errand'] }),
  t({ title: 'Wireframe the new onboarding', projectId: 'p_launch', dueOffset: -3, priority: 2, done: true, doneOffset: -1, labels: ['l_deep'] }),
  t({ title: 'Cancel unused subscriptions', projectId: 'p_home', dueOffset: -4, priority: 4, done: true, doneOffset: -2 }),
];

export const DATA = { labels, projects, tasks };

export function parseTask(raw, projects = [], existingLabels = []) {
  let text = raw;
  let priority = 4;
  let dueOffset = null;
  let startOffset = null;
  let time = null;
  let startTime = null;
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

  // 5a. Parse date-time ranges before individual date/time parsers.
  //     Handles: "thursday 5pm to thursday 6pm", "today 9am to 11am", "5pm to 6pm", etc.
  {
    const parseHMStr = (h, min, ampm) => {
      let hh = parseInt(h);
      const mm = min ? parseInt(min) : 0;
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hh < 12) hh += 12;
        if (ampm.toLowerCase() === 'am' && hh === 12) hh = 0;
      }
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    const dowList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dateKw = `(?:today|tomorrow|next\\s+week|${dowList.join('|')})`;
    const timePart = `(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?`;
    const rangeRe = new RegExp(
      `(?:(${dateKw})\\s+)?${timePart}\\s+to\\s+(?:(${dateKw})\\s+)?${timePart}`,
      'i'
    );
    const rm = text.match(rangeRe);
    // Require at least one explicit am/pm or :MM to avoid matching bare "5 to 6"
    if (rm && (rm[4] || rm[8] || rm[3] || rm[7])) {
      const st = parseHMStr(rm[2], rm[3], rm[4]);
      const et = parseHMStr(rm[6], rm[7], rm[8]);
      if (st && et) {
        startTime = st;
        time = et;
        const resolveDate = (kw) => {
          if (!kw) return null;
          const k = kw.toLowerCase().replace(/\s+/, ' ');
          if (k === 'today') return 0;
          if (k === 'tomorrow') return 1;
          if (k === 'next week') return 7;
          const di = dowList.indexOf(k);
          if (di !== -1) {
            let diff = di - today.getDay();
            if (diff < 0) diff += 7;
            return diff;
          }
          return null;
        };
        const sd = resolveDate(rm[1]);
        const ed = resolveDate(rm[5]);
        if (sd !== null) { startOffset = sd; dueOffset = sd; }
        if (ed !== null) dueOffset = ed;
        if (ed !== null && sd === null) startOffset = ed;
        text = text.replace(rangeRe, '');
      }
    }
  }
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
    startOffset,
    time,
    startTime,
    priority,
    projectId,
    labels: taskLabels,
    recurring
  };
}

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

// minutes → compact human label: 30 → "30m", 60 → "1h", 90 → "1h 30m"
export function fmtDuration(min) {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// "HH:MM" + minutes → "HH:MM" (wraps within the day)
export function addMinutesToHM(hm, min) {
  const mm = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!mm) return null;
  let total = (+mm[1]) * 60 + (+mm[2]) + (min || 0);
  total = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dateRangeLabel(startOffset, dueOffset, time, startTime, duration) {
  const showTime = time && dueOffset !== 'someday';
  const showStartTime = startTime && startOffset !== 'someday';

  // A single due time with a duration renders as "time → end (dur)".
  // Only applies when there is no separate start-time range to show.
  const timePart = (t) => {
    const end = duration > 0 ? addMinutesToHM(t, duration) : null;
    return end ? `${t} → ${end} (${fmtDuration(duration)})` : t;
  };

  if (startOffset === null || startOffset === undefined) {
    const d = dueLabel(dueOffset);
    if (!d) return null;
    return d.text + (showTime ? ` · ${timePart(time)}` : '');
  }
  if (dueOffset === null || dueOffset === undefined) {
    const s = dueLabel(startOffset);
    if (!s) return null;
    return `Start: ${s.text}` + (showStartTime ? ` · ${startTime}` : '');
  }
  if (startOffset === dueOffset) {
    const d = dueLabel(dueOffset);
    if (showStartTime && showTime) {
      return `${d.text} · ${startTime} → ${time}`;
    }
    if (showStartTime) {
      return `${d.text} · ${startTime}`;
    }
    return d.text + (showTime ? ` · ${timePart(time)}` : '');
  }
  const s = dueLabel(startOffset);
  const d = dueLabel(dueOffset);
  const startPart = s.text + (showStartTime ? ` · ${startTime}` : '');
  const endPart = d.text + (showTime ? ` · ${time}` : '');
  return `${startPart} → ${endPart}`;
}

export const H = {
  MS_DAY,
  startOfToday,
  dateFromOffset,
  offsetFromDate,
  MONTHS,
  MONTHS_LONG,
  DOW,
  DOW_LONG,
  dueLabel,
  fmtDuration,
  addMinutesToHM,
  labelById: (id) => labels.find((l) => l.id === id),
  projectById: (id) => projects.find((p) => p.id === id),
  priorityColor: (p) => ({ 1: '#E44332', 2: '#F5A623', 3: '#2D7FF9', 4: null })[p] || null,
  parseTask,
  advanceRecurring,
  dateRangeLabel,
};
