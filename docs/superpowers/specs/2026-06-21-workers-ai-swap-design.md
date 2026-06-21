# Swap AI provider to Cloudflare Workers AI — design

**Date:** 2026-06-21 · Follow-up to feature F (AI subtasks) and C (NL filter).

## Goal

Move the two AI endpoints from Anthropic (needs `ANTHROPIC_API_KEY`, paid) to **Cloudflare Workers AI** (AI binding, free within the daily Neuron allowance). No API key to manage.

## Decisions

1. **Binding:** add `[ai] binding = "AI"` to `wrangler.toml`. In Pages Functions the model is called via `env.AI.run(model, input)` — no `fetch`, no key.
2. **Model:** `@cf/meta/llama-3.1-8b-instruct` held in the existing `MODEL` constant in each route. (A bigger, smarter free-tier option `@cf/meta/llama-3.3-70b-instruct-fp8-fast` can be swapped in; it spends more Neurons per call.)
3. **Graceful degradation:** keep the 503 `not_configured` path, but key it on the **binding** (`if (!env.AI) return 503`) instead of `env.ANTHROPIC_API_KEY`. The UI's "AI isn't set up yet" message still works if the binding is missing (e.g. local dev without it).
4. **JSON output:** Workers AI supports `response_format: { type: "json_schema", json_schema: {...} }` — same schemas we already pass. The response comes back as `{ response: <object | string> }`, so normalize it to a text string with a new pure helper `aiResponseToText(out)` before handing to the existing `parseSubtasks` / `parseFilterQuery`.
5. **Unchanged:** pure helpers `buildSubtaskPrompt`/`parseSubtasks`/`buildFilterPrompt`/`parseFilterQuery`, the UI, and all front-end behavior. Only the two route files + `wrangler.toml` + one new helper change.

## Quality note

Llama-3.1-8b is smaller and less reliable than Claude, especially for the natural-language→query translation. Acceptable for these low-stakes helpers; the model constant is the lever to upgrade.

## Testing

`tests/ai.test.mjs`: add `aiResponseToText` cases — string passthrough, object → JSON string, null/undefined → "". Existing parse tests unchanged. Route + binding verified by `npm run build` + review (no Workers integration harness).

## Acceptance

- Endpoints call `env.AI.run` with the JSON schema; no `ANTHROPIC_API_KEY` reference remains in the routes.
- With the binding present, subtasks/filter generation works; without it, 503 → UI shows "AI isn't set up yet".
- New unit test passes; full suite green; build succeeds.
