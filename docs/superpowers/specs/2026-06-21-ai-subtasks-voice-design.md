# AI break-into-subtasks + voice capture — design

**Date:** 2026-06-21 · **Feature:** F (A, B, D, E done). Two independent halves.

## Goal

1. **AI subtasks:** a button on a task that asks an LLM to break it into 3–7 subtasks and adds them.
2. **Voice capture:** a mic button that dictates text into the quick-add composer.

Both must appear on **desktop (`App.jsx`/`composer.jsx`/`detail.jsx`) and mobile (`MobileApp.jsx`)** — the detail (`detail.jsx`) and composer are shared, so wire the UI where both clients reach it and verify each.

## Background (verified)

- Backend is Cloudflare Pages Functions in `functions/api/*.js` (Workers runtime; `onRequestPost({request, env})`, `Response`). They run behind Cloudflare Access. D1 bound as `env.DB`.
- Service worker bypasses `/api/*` (memory: SW never cache /api) — the new route is not cached.
- `addSubtask(taskId, title)` exists in `store.jsx`; subtasks are `{id, title, done, ...}`.
- Detail editor in `detail.jsx` is shared by desktop and mobile. Composer quick-add in `composer.jsx`; mobile has its own quick-add entry — wire the mic into the shared input component and confirm both.

## Decisions (defaults)

1. **Provider: Anthropic Claude**, model `claude-opus-4-8` (per the claude-api skill's model rule), held in a single `MODEL` constant in the function so it can be swapped to `claude-haiku-4-5` to cut cost. Called via raw `fetch` to `https://api.anthropic.com/v1/messages` (the Workers-native primitive; no SDK dependency added).
2. **Graceful degradation:** the endpoint returns `503 {error:'not_configured'}` when `env.ANTHROPIC_API_KEY` is unset. The UI detects this and shows "AI isn't set up" instead of erroring. The feature ships inert and costs nothing until the user sets the secret (`wrangler pages secret put ANTHROPIC_API_KEY`).
3. **Structured output:** the request uses `output_config.format` with a JSON schema `{subtasks: string[]}` so the response is guaranteed parseable. Server clamps to ≤12 subtasks, trims, drops empties.
4. **Subtask button** lives in the task detail (shared). Loading + error states. On success, each returned string is added via `addSubtask`.
5. **Voice capture:** uses the browser `SpeechRecognition`/`webkitSpeechRecognition` API. Feature-detected — the mic button is hidden where unsupported. Transcribed text is inserted into the composer input. No backend, no cost.
6. **Pure logic** (`functions/api/_ai.js`, leading underscore = not a Pages route): `buildSubtaskPrompt(title, note)` and `parseSubtasks(text)` (parse JSON, clean, clamp). Unit-tested. The route file imports these and does the `fetch`.

## Security / cost notes

- The API key lives only in the Worker `env`, never sent to the browser. The browser calls our `/api/ai-subtasks`, which calls Anthropic server-side.
- No usage occurs until the user sets the secret. The model constant is the cost lever.
- Input is length-clamped (title ≤500, note ≤2000 chars) before sending.

## Out of scope

Voice → full task parsing pipeline, streaming the subtask generation, AI for the natural-language filter (that is feature C, which will reuse this endpoint), multi-language voice config beyond the browser default.

## Testing

`tests/ai.test.mjs` (`node --test`) over `functions/api/_ai.js`:
- `buildSubtaskPrompt`: includes the title; includes the note only when present; clamps lengths.
- `parseSubtasks`: parses `{"subtasks":[...]}`; trims and drops empty/whitespace items; clamps to 12; returns `[]` on invalid JSON.

The route's network call and the Web Speech UI are verified by `npm run build` + code review (no Worker/integration harness here; existing function tests use a fake D1 but don't hit the network). Acknowledged.

## Acceptance

- With no `ANTHROPIC_API_KEY`, the subtask button shows "AI isn't set up" and nothing breaks.
- With the key set, clicking it adds 3–7 subtasks to the task (desktop + mobile).
- The mic button appears only where supported; dictating inserts text into the composer.
- New unit tests pass; full suite green; `npm run build` succeeds.
