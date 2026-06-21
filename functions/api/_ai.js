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
