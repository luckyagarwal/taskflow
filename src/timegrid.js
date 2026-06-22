// src/timegrid.js — pure helpers for the calendar day time-grid (no React).

export function parseHM(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function fmtHM(total) {
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function blockMinutes(task, defaultDuration = 60) {
  const d = task && task.duration;
  return typeof d === "number" && d > 0 ? d : defaultDuration;
}

export function layoutDayTasks(tasks, { defaultDuration = 60 } = {}) {
  const items = [];
  for (const t of tasks) {
    const startMin = parseHM(t.time);
    if (startMin == null) continue;
    items.push({ task: t, startMin, endMin: startMin + blockMinutes(t, defaultDuration) });
  }
  items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = Math.max(...cluster.map((c) => c.lane + 1));
    for (const c of cluster) { c.lanes = lanes; out.push(c); }
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    if (it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= it.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endMin); }
    else laneEnds[lane] = it.endMin;
    it.lane = lane;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

// Pixel offset within the track -> minute of day (0..1439), scaled by hour height.
export function yToMin(y, hourH) {
  const min = Math.round((y / hourH) * 60);
  return Math.max(0, Math.min(1439, min));
}

// Round a minute value to the nearest `step`, clamped so a step-sized block
// still fits before midnight.
export function snapMin(min, step = 5) {
  const snapped = Math.round(min / step) * step;
  return Math.max(0, Math.min(1440 - step, snapped));
}

// Two raw minute values (drag start/end, any order) -> a clean snapped range.
export function makeRange(aMin, bMin, { step = 5, minDur = 5 } = {}) {
  let lo = snapMin(Math.min(aMin, bMin), step);
  let hi = snapMin(Math.max(aMin, bMin), step);
  let durationMin = Math.max(minDur, hi - lo);
  if (lo + durationMin > 1440) lo = Math.max(0, 1440 - durationMin);
  return { startMin: lo, durationMin };
}
