# AI Subtasks + Voice Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** An LLM endpoint that breaks a task into subtasks (graceful when unconfigured) + browser voice dictation into the composer. Both surfaces (desktop + mobile).

**Architecture:** Pure prompt/parse logic in `functions/api/_ai.js` (tested). Route `functions/api/ai-subtasks.js` calls Anthropic via `fetch`. UI: subtask button in `detail.jsx`, mic in `composer.jsx` — verified on desktop and mobile. No schema/sync change.

**Spec:** `docs/superpowers/specs/2026-06-21-ai-subtasks-voice-design.md`

---

## Task 1: Pure AI helpers + tests (`functions/api/_ai.js`)

**Files:** Create `functions/api/_ai.js`, create `tests/ai.test.mjs`.

- [ ] **Step 1: Write `tests/ai.test.mjs`:**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSubtaskPrompt, parseSubtasks } from "../functions/api/_ai.js";

test("buildSubtaskPrompt: includes title, omits empty note", () => {
  const p = buildSubtaskPrompt("Plan birthday party", "");
  assert.match(p, /Plan birthday party/);
  assert.doesNotMatch(p, /Details:/);
});

test("buildSubtaskPrompt: includes note when present", () => {
  const p = buildSubtaskPrompt("Ship release", "v2 with migration");
  assert.match(p, /Ship release/);
  assert.match(p, /Details: v2 with migration/);
});

test("buildSubtaskPrompt: clamps overly long input", () => {
  const p = buildSubtaskPrompt("x".repeat(1000), "y".repeat(5000));
  assert.ok(p.length < 3200, `prompt too long: ${p.length}`);
});

test("parseSubtasks: parses, trims, drops empties, clamps to 12", () => {
  const many = Array.from({ length: 20 }, (_, i) => `task ${i}`);
  const text = JSON.stringify({ subtasks: ["  a ", "", "   ", "b", ...many] });
  const out = parseSubtasks(text);
  assert.equal(out[0], "a");
  assert.equal(out[1], "b");
  assert.ok(!out.includes(""));
  assert.equal(out.length, 12);
});

test("parseSubtasks: invalid JSON → []", () => {
  assert.deepEqual(parseSubtasks("not json"), []);
  assert.deepEqual(parseSubtasks(JSON.stringify({ nope: 1 })), []);
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/ai.test.mjs`.

- [ ] **Step 3: Implement `functions/api/_ai.js`:**

```js
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
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/ai.test.mjs`, then `npm test` (full green).

- [ ] **Step 5: Commit** — `git add functions/api/_ai.js tests/ai.test.mjs && git commit -m "feat(ai): pure subtask prompt/parse helpers + tests"` (+ trailer).

---

## Task 2: The AI route (`functions/api/ai-subtasks.js`)

**Files:** Create `functions/api/ai-subtasks.js`. (Read an existing function e.g. `functions/api/save.js` first to match the `onRequest*` + `Response` style.)

- [ ] **Implement** the POST handler:

```js
// functions/api/ai-subtasks.js — POST { title, note } -> { subtasks: string[] }
import { buildSubtaskPrompt, parseSubtasks } from "./_ai.js";

// Cost/latency lever: switch to "claude-haiku-4-5" to reduce cost.
const MODEL = "claude-opus-4-8";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const title = String(body?.title || "").trim();
  if (!title) return json({ error: "missing_title" }, 400);

  const prompt = buildSubtaskPrompt(title, body?.note);

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
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { subtasks: { type: "array", items: { type: "string" } } },
              required: ["subtasks"],
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
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return json({ subtasks: parseSubtasks(text) });
}
```

- [ ] **Verify** `npm run build` still succeeds (the route is bundled by wrangler at deploy, but the build must not break). Confirm no import error from `./_ai.js`.
- [ ] **Commit** — `git add functions/api/ai-subtasks.js && git commit -m "feat(ai): /api/ai-subtasks route (Anthropic, graceful when unconfigured)"` (+ trailer).

---

## Task 3: Subtask button in detail + voice mic in composer (`src/detail.jsx`, `src/composer.jsx`)

**Files:** Modify `src/detail.jsx`, `src/composer.jsx`. Read both first. Verify the change reaches **desktop and mobile** (detail is shared; composer input is shared — confirm the mobile quick-add uses the same input or add it there too).

- [ ] **Subtask button (`detail.jsx`):** near the subtasks section, add a button "Suggest subtasks (AI)". On click:
  - set a local `aiLoading` state; `POST /api/ai-subtasks` with `{ title: task.title, note: task.note }` (`fetch`, JSON).
  - On `503` (`error: 'not_configured'`): show a small inline message "AI isn't set up yet" (no throw).
  - On success: for each string in `subtasks`, call the existing `addSubtask(task.id, str)`.
  - On other error: show "Couldn't generate subtasks". Always clear `aiLoading`.
  - Disable the button while loading; show a spinner/"…" label.
- [ ] **Voice mic (`composer.jsx`):** in the quick-add text input area, add a mic button shown only when `('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)`. On click, start recognition (`const R = window.SpeechRecognition || window.webkitSpeechRecognition; const r = new R(); r.lang = navigator.language || 'en-US'; r.interimResults = false;`), and on `result` append `event.results[0][0].transcript` to the composer input value (use the existing input state setter). Toggle a "listening" visual while active; stop on `end`. Guard all of it behind the feature check so unsupported browsers never see the button.
- [ ] Confirm the mobile quick-add path also exposes the mic (if mobile uses a different input component, add the same feature-detected button there).

- [ ] **Verify** `npm run build` succeeds; `npm test` stays green.
- [ ] **Commit** — `git add src/detail.jsx src/composer.jsx && git commit -m "feat(ai): AI subtask button in detail + voice dictation mic in composer"` (+ trailer). (Include `src/MobileApp.jsx` in the add if the mobile quick-add needed the mic wired separately.)

---

## Task 4: Final verification

- [ ] `npm test` → all green (parse, projects, status, timegrid, ai, sync, storage, sw).
- [ ] `npm run build` → succeeds.
- [ ] `git push origin main`.
- [ ] Note for the user: to enable AI, set the secret — `wrangler pages secret put ANTHROPIC_API_KEY` (or add it in the Cloudflare Pages dashboard → Settings → Environment variables). Until then the button shows "AI isn't set up".

---

## Self-Review

- Spec → tasks: graceful 503 (T2), structured output schema (T2), pure prompt/parse + tests (T1), subtask button (T3), feature-detected voice mic (T3), both surfaces (T3 explicit). Covered.
- No placeholders in T1/T2 (full code). T3 integrates into shared JSX with exact endpoint, payload, store action (`addSubtask`), and the Web Speech API calls; says read-the-file and verify both clients.
- Type/name consistency: `buildSubtaskPrompt`/`parseSubtasks` identical across `_ai.js`, tests, and the route import. Route path `/api/ai-subtasks` matches the filename `functions/api/ai-subtasks.js`. `MODEL` constant is the single cost lever named in the spec.
- Security: API key only in `env`, never to the browser; input length-clamped in `buildSubtaskPrompt`. Stated.
- Known limitation: no Worker/Web-Speech integration tests; verified via build + review.
