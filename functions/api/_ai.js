// functions/api/_ai.js — pure helpers for the AI subtask endpoint.
// Leading underscore: Cloudflare Pages does NOT treat this as a route.

const MAX_TITLE = 500;
const MAX_NOTE = 2000;
const MAX_SUBTASKS = 12;

export function buildSubtaskPrompt(title, note) {
  const t = String(title || "").slice(0, MAX_TITLE).trim();
  const n = String(note || "").slice(0, MAX_NOTE).trim();
  let p =
    "Break this task into 3-7 concrete, actionable subtasks. " +
    "Each subtask is a short imperative phrase (e.g. \"Draft the outline\"), " +
    "no numbering and no trailing punctuation.\n\nTask: " + t;
  if (n) p += "\nDetails: " + n;
  return p;
}

export function parseSubtasks(text) {
  let arr;
  try {
    arr = JSON.parse(text).subtasks;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s) => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SUBTASKS);
}

export function buildFilterPrompt(text, labels = [], projects = []) {
  const labelNames = labels.map((l) => l && l.name).filter(Boolean).slice(0, 100).join(", ");
  const projectNames = projects.map((p) => p && p.name).filter(Boolean).slice(0, 100).join(", ");
  return [
    "Translate the user request into a task-filter query using this mini-language:",
    "- priority: p1 p2 p3 p4",
    "- due: overdue, today, upcoming, nodate, someday",
    "- status: planned, inprogress, blocked, waiting, done, recurring",
    "- label: @name   project: #name (or inbox)",
    "- combine with & (and), | (or), ! (not), and parentheses",
    "Available label names: " + (labelNames || "(none)"),
    "Available project names: " + (projectNames || "(none)"),
    "For @label and #project, use the name lowercased with spaces removed.",
    "Return only the query string, nothing else.",
    "",
    "Request: " + String(text || "").slice(0, 500).trim(),
  ].join("\n");
}

export function parseFilterQuery(responseText) {
  try {
    const q = JSON.parse(responseText).query;
    return typeof q === "string" ? q.trim().slice(0, 200) : "";
  } catch {
    return "";
  }
}
