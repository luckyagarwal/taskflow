# Saved Filters + Query Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** A task-query DSL with a live filter bar, saved filters (localStorage), and a natural-language mode via an AI endpoint. Both desktop and mobile.

**Architecture:** Pure compiler `src/query.js` (tested). Pure NL prompt/parse added to `functions/api/_ai.js` (tested) + route `functions/api/nl-filter.js`. Store gains localStorage-backed saved filters. UI: query bar in FiltersView + `SavedFilterView` + routing/sidebar/Browse. No Dexie/sync change.

**Spec:** `docs/superpowers/specs/2026-06-21-query-filters-design.md`

---

## Task 1: Pure query compiler + tests (`src/query.js`)

**Files:** Create `src/query.js`, create `tests/query.test.mjs`.

- [ ] **Step 1: Write `tests/query.test.mjs`:**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileQuery } from "../src/query.js";

const ctx = {
  labels: [{ id: "l_email", name: "email" }, { id: "l_deep", name: "deep work" }],
  projects: [{ id: "p_work", name: "Work" }, { id: "p_home", name: "Home" }],
};
const mk = (o = {}) => ({ priority: 4, dueOffset: null, status: "planned", labels: [], projectId: "inbox", done: false, ...o });
const run = (q, task) => { const c = compileQuery(q, ctx); assert.ok(c.ok, c.error); return c.predicate(task); };

test("empty query matches all", () => {
  const c = compileQuery("", ctx);
  assert.equal(c.empty, true);
  assert.equal(c.predicate(mk()), true);
});

test("priority term", () => {
  assert.equal(run("p1", mk({ priority: 1 })), true);
  assert.equal(run("p1", mk({ priority: 2 })), false);
});

test("due buckets", () => {
  assert.equal(run("overdue", mk({ dueOffset: -2 })), true);
  assert.equal(run("overdue", mk({ dueOffset: 0 })), false);
  assert.equal(run("today", mk({ dueOffset: 0 })), true);
  assert.equal(run("upcoming", mk({ dueOffset: 3 })), true);
  assert.equal(run("nodate", mk({ dueOffset: null })), true);
  assert.equal(run("nodate", mk({ dueOffset: 1 })), false);
});

test("done sets usesDone and matches completed", () => {
  const c = compileQuery("done", ctx);
  assert.equal(c.usesDone, true);
  assert.equal(c.predicate(mk({ done: true })), true);
});

test("status and recurring", () => {
  assert.equal(run("blocked", mk({ status: "blocked" })), true);
  assert.equal(run("recurring", mk({ recurring: { type: "day" } })), true);
});

test("@label resolves spaces-removed; unknown matches nothing", () => {
  assert.equal(run("@email", mk({ labels: ["l_email"] })), true);
  assert.equal(run("@deepwork", mk({ labels: ["l_deep"] })), true);
  assert.equal(run("@nope", mk({ labels: ["l_email"] })), false); // unknown → false, still ok
  assert.equal(compileQuery("@nope", ctx).ok, true);
});

test("#project and inbox", () => {
  assert.equal(run("#work", mk({ projectId: "p_work" })), true);
  assert.equal(run("#inbox", mk({ projectId: "inbox" })), true);
  assert.equal(run("inbox", mk({ projectId: "inbox" })), true);
});

test("operators: and / or / not / parens / implicit-and", () => {
  assert.equal(run("p1 & overdue", mk({ priority: 1, dueOffset: -1 })), true);
  assert.equal(run("p1 & overdue", mk({ priority: 1, dueOffset: 2 })), false);
  assert.equal(run("p1 | p2", mk({ priority: 2 })), true);
  assert.equal(run("!done", mk({ done: false })), true);
  assert.equal(run("!done", mk({ done: true })), false);
  assert.equal(run("(p1 | p2) & today", mk({ priority: 2, dueOffset: 0 })), true);
  assert.equal(run("p1 overdue", mk({ priority: 1, dueOffset: -1 })), true); // implicit AND
});

test("errors", () => {
  assert.equal(compileQuery("bogusterm", ctx).ok, false);
  assert.equal(compileQuery("(p1 | p2", ctx).ok, false);
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/query.test.mjs`.

- [ ] **Step 3: Implement `src/query.js`:**

```js
// src/query.js — pure task-query language (no React).
// compileQuery(str, {labels, projects}) -> { ok, predicate, usesDone, error, empty }

const PRIORITY = { p1: 1, p2: 2, p3: 3, p4: 4 };
const STATUSES = ["planned", "inprogress", "blocked", "waiting"];
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");

// Returns { fn } | { fn, usesDone } | { error }
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
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/query.test.mjs`, then `npm test` (full green).
- [ ] **Step 5: Commit** — `git add src/query.js tests/query.test.mjs && git commit -m "feat(filters): pure task-query compiler + tests"` (+ trailer).

---

## Task 2: NL-filter helpers + route (`functions/api/_ai.js`, `functions/api/nl-filter.js`)

**Files:** Modify `functions/api/_ai.js`, create `functions/api/nl-filter.js`, extend `tests/ai.test.mjs`.

- [ ] **Step 1: Append to `tests/ai.test.mjs`** (keep existing imports; add to the import line):

```js
import { buildFilterPrompt, parseFilterQuery } from "../functions/api/_ai.js";

test("buildFilterPrompt includes request, names, grammar", () => {
  const p = buildFilterPrompt("urgent work tasks", [{ name: "email" }], [{ name: "Work" }]);
  assert.match(p, /urgent work tasks/);
  assert.match(p, /email/);
  assert.match(p, /Work/);
  assert.match(p, /p1/); // grammar mentioned
});

test("parseFilterQuery extracts query; '' on bad json", () => {
  assert.equal(parseFilterQuery(JSON.stringify({ query: "  p1 & overdue " })), "p1 & overdue");
  assert.equal(parseFilterQuery("nonsense"), "");
  assert.equal(parseFilterQuery(JSON.stringify({ nope: 1 })), "");
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/ai.test.mjs`.

- [ ] **Step 3: Append to `functions/api/_ai.js`:**

```js
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
```

- [ ] **Step 4: Create `functions/api/nl-filter.js`:**

```js
// functions/api/nl-filter.js — POST { text, labels, projects } -> { query: string }
import { buildFilterPrompt, parseFilterQuery } from "./_ai.js";

const MODEL = "claude-opus-4-8"; // switch to "claude-haiku-4-5" to cut cost

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "missing_text" }, 400);

  const prompt = buildFilterPrompt(text, body?.labels || [], body?.projects || []);

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
  } catch (e) {
    return json({ error: "network", detail: String(e).slice(0, 200) }, 502);
  }

  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    return json({ error: "upstream", status: resp.status, detail }, 502);
  }

  const data = await resp.json();
  const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return json({ query: parseFilterQuery(out) });
}
```

- [ ] **Step 5:** Run `node --test tests/ai.test.mjs` (pass), `npm test` (green), `npm run build` (succeeds).
- [ ] **Step 6: Commit** — `git add functions/api/_ai.js functions/api/nl-filter.js tests/ai.test.mjs && git commit -m "feat(filters): natural-language -> query endpoint + pure helpers"` (+ trailer).

---

## Task 3: Saved filters in store (`src/store.jsx`)

**Files:** Modify `src/store.jsx`. Read the existing localStorage prefs pattern (`todo-proto-density` etc.) first and mirror it.

- [ ] Add `savedFilters` state initialized from `localStorage['todo-proto-saved-filters']` (JSON array, default `[]`), persisted in a `useEffect` on change (same pattern as density/theme).
- [ ] `addSavedFilter(name, query)` — push `{ id: uid('sf_'), name: name.trim(), query }` (reuse the existing `uid()` helper); ignore empty name/query. `deleteSavedFilter(id)` — filter it out.
- [ ] Expose `savedFilters`, `addSavedFilter`, `deleteSavedFilter` in the context value object.

- [ ] **Verify** `npm run build` + `npm test`. **Commit** — `git add src/store.jsx && git commit -m "feat(filters): localStorage-backed saved filters in store"` (+ trailer).

---

## Task 4: Query bar UI + SavedFilterView + routing (both surfaces) (`src/views.jsx`, `src/App.jsx`, `src/MobileApp.jsx`)

**Files:** Modify `src/views.jsx`, `src/App.jsx`, `src/MobileApp.jsx`. Read each first. Import `compileQuery` from `./query.js`.

- [ ] **FiltersView query bar (`views.jsx`):** above the existing labels grid, add:
  - A text `<input>` bound to local `query` state, placeholder e.g. `p1 & overdue`.
  - Compile on change: `const { ok, predicate, usesDone, error, empty } = compileQuery(query, { labels, projects })`. Show `error` inline (muted/red) when `!ok`.
  - When `ok && !empty`: base = `usesDone ? tasks : tasks.filter(t=>!t.done)`; `const results = base.filter(predicate)`; render `<TaskGroup tasks={results} density={density} showProject />` under a `SectionHeader title="Results" count={results.length}`.
  - A "Save" button: when there's a valid non-empty query, prompt for a name (`window.prompt('Filter name')`) and call `addSavedFilter(name, query)`.
  - An "Ask in words" button: prompt for NL text (`window.prompt('Describe the tasks you want')`), `POST /api/nl-filter` with `{ text, labels: labels.map(l=>({name:l.name})), projects: projects.map(p=>({name:p.name})) }`. On `503` show "AI isn't set up yet"; on success set `query` to the returned `query` string. Reuse the loading/error pattern from the detail AI button.
- [ ] **`SavedFilterView` (`views.jsx`):** new exported component `SavedFilterView({ filterId, density })`. Look up the saved filter by id from `savedFilters`; compile its query; render the results with a `ViewHeader` titled with the filter name and a delete affordance (`deleteSavedFilter`). Same base/usesDone rule.
- [ ] **Desktop (`App.jsx`):** add `case 'saved-filter': content = <V.SavedFilterView filterId={view.id} density={density} />; break;`. In the sidebar, under the "Filters & Labels" nav item, map `savedFilters` to NavItems (`onClick={() => setView({ type:'saved-filter', id: f.id })}`, active when `view.type==='saved-filter' && view.id===f.id`). Add `|| view.type==='saved-filter'` to the Filters nav active guard if appropriate.
- [ ] **Mobile (`MobileApp.jsx`):** add the same `case 'saved-filter'` to MobileContent. In `BrowseView`, render saved filters (a small list/section of rows) that `setView({ type:'saved-filter', id })`.

- [ ] **Verify** `npm run build` succeeds; `npm test` green. **Commit** — `git add src/views.jsx src/App.jsx src/MobileApp.jsx && git commit -m "feat(filters): query bar, saved-filter view, sidebar + mobile listings"` (+ trailer).

---

## Task 5: Final verification

- [ ] `npm test` → all green (parse, projects, status, timegrid, ai, query, sync, storage, sw).
- [ ] `npm run build` → succeeds.
- [ ] `git push origin main`.

---

## Self-Review

- Spec → tasks: DSL compiler + usesDone (T1), NL endpoint + pure helpers (T2), localStorage saved filters (T3), query bar + SavedFilterView + both-surface routing + NL button (T4). Covered.
- No placeholders in T1/T2 (full code + tests). T3/T4 integrate into existing files with exact state pattern, endpoint, payload, store actions, and view-type names.
- Type/name consistency: `compileQuery` signature + return keys (`ok, predicate, usesDone, error, empty`) identical across `src/query.js`, tests, and T4 usage. `buildFilterPrompt`/`parseFilterQuery` identical across `_ai.js`, tests, route. Store actions `addSavedFilter(name, query)` / `deleteSavedFilter(id)` and `savedFilters` named consistently T3↔T4. View type string `'saved-filter'` consistent across App/MobileApp/views. Route path `/api/nl-filter` matches filename.
- Security: NL endpoint key server-side only (mirrors ai-subtasks); 503-graceful. Input clamped in `buildFilterPrompt`.
- Known limitation: saved filters are device-local (localStorage), not synced; no component/Worker integration tests — verified via build + review.
