// src/status.js — task status model + Kanban board grouping (pure, no React).

export const STATUS_ORDER = ["planned", "inprogress", "blocked", "waiting", "done"];

export const STATUS_LABELS = {
  planned: "Planned",
  inprogress: "In Progress",
  blocked: "Blocked",
  waiting: "Waiting",
  done: "Done",
};

export function statusPatch(target) {
  if (target === "done") return { status: "done", done: true, doneOffset: 0 };
  return { status: target, done: false, doneOffset: null };
}

export function columnOf(task) {
  if (task.done) return "done";
  return STATUS_ORDER.includes(task.status) ? task.status : "planned";
}

export function groupTasksByStatus(tasks, { projectId = null, recentDoneDays = 7 } = {}) {
  const cols = {};
  for (const k of STATUS_ORDER) cols[k] = [];
  for (const t of tasks) {
    if (projectId && t.projectId !== projectId) continue;
    const visible = !t.done || (typeof t.doneOffset === "number" && t.doneOffset >= -recentDoneDays);
    if (!visible) continue;
    cols[columnOf(t)].push(t);
  }
  return cols;
}
