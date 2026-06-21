// src/query.js — pure task-query language (no React).
// compileQuery(str, {labels, projects}) -> { ok, predicate, usesDone, error, empty }

const PRIORITY = { p1: 1, p2: 2, p3: 3, p4: 4 };
const STATUSES = ["planned", "inprogress", "blocked", "waiting"];
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");

function atom(tok, ctx) {
  const t = tok.toLowerCase();
  if (PRIORITY[t]) { const p = PRIORITY[t]; return { fn: (k) => k.priority === p }; }
  if (t === "overdue") return { fn: (k) => !k.done && typeof k.dueOffset === "number" && k.dueOffset < 0 };
  if (t === "today") return { fn: (k) => !k.done && k.dueOffset === 0 };
  if (t === "upcoming") return { fn: (k) => !k.done && typeof k.dueOffset === "number" && k.dueOffset > 0 };
  if (t === "nodate") return { fn: (k) => k.dueOffset === null || k.dueOffset === undefined };
  if (t === "someday") return { fn: (k) => k.dueOffset === "someday" };
  if (t === "recurring") return { fn: (k) => !!k.recurring };
  if (t === "inbox") return { fn: (k) => k.projectId === "inbox" };
  if (t === "done") return { fn: (k) => k.done === true, usesDone: true };
  if (STATUSES.includes(t)) return { fn: (k) => (k.status || "planned") === t };
  if (tok[0] === "@") {
    const name = norm(tok.slice(1));
    const lab = (ctx.labels || []).find((l) => norm(l.name) === name);
    const id = lab && lab.id;
    return { fn: (k) => !!id && Array.isArray(k.labels) && k.labels.includes(id) };
  }
  if (tok[0] === "#") {
    const name = norm(tok.slice(1));
    if (name === "inbox") return { fn: (k) => k.projectId === "inbox" };
    const proj = (ctx.projects || []).find((p) => norm(p.name) === name);
    const id = proj && proj.id;
    return { fn: (k) => !!id && k.projectId === id };
  }
  return { error: `Unknown term: "${tok}"` };
}

function tokenize(str) {
  const out = [];
  const isOp = (c) => "&|()!".includes(c);
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (/\s/.test(c)) { i++; continue; }
    if (isOp(c)) { out.push(c); i++; continue; }
    let j = i;
    while (j < str.length && !/\s/.test(str[j]) && !isOp(str[j])) j++;
    out.push(str.slice(i, j));
    i = j;
  }
  return out;
}

export function compileQuery(input, ctx = {}) {
  const str = String(input || "").trim();
  if (!str) return { ok: true, predicate: () => true, usesDone: false, empty: true };
  const tokens = tokenize(str);
  let pos = 0;
  let usesDone = false;
  const peek = () => tokens[pos];
  const atEnd = () => pos >= tokens.length;

  function parseOr() {
    let node = parseAnd();
    while (peek() === "|") { pos++; const r = parseAnd(); const a = node; node = (k) => a(k) || r(k); }
    return node;
  }
  function parseAnd() {
    let node = parseNot();
    while (!atEnd() && peek() !== "|" && peek() !== ")") {
      if (peek() === "&") pos++;
      const r = parseNot();
      const a = node;
      node = (k) => a(k) && r(k);
    }
    return node;
  }
  function parseNot() {
    if (peek() === "!") { pos++; const r = parseNot(); return (k) => !r(k); }
    return parseAtom();
  }
  function parseAtom() {
    const tok = peek();
    if (tok === undefined) throw new Error("Unexpected end of query");
    if (tok === "(") {
      pos++;
      const e = parseOr();
      if (peek() !== ")") throw new Error("Missing closing )");
      pos++;
      return e;
    }
    if (tok === ")" || tok === "&" || tok === "|") throw new Error(`Unexpected "${tok}"`);
    pos++;
    const a = atom(tok, ctx);
    if (a.error) throw new Error(a.error);
    if (a.usesDone) usesDone = true;
    return a.fn;
  }

  try {
    const predicate = parseOr();
    if (!atEnd()) throw new Error(`Unexpected "${peek()}"`);
    return { ok: true, predicate, usesDone };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
