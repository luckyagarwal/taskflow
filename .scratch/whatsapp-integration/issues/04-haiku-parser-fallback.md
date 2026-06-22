# 04 — AI parser fallback (Cloudflare Workers AI)

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

Improve Capture quality for messy phrasing. When the regex parser is low-confidence, fall back to a
Cloudflare Workers AI call (the `env.AI` binding, same pattern as `functions/api/ai-subtasks.js` and
`functions/api/nl-filter.js` — no API key) that returns a structured task (title, dueOffset, time,
priority, labels), which then flows through the same Capture path.

## Acceptance criteria

- [ ] A clearly-structured message still uses the regex parser (no model call).
- [ ] A low-confidence message routes to the Workers AI fallback and produces a correct structured Task.
- [ ] The fallback reuses the existing Workers AI pattern (`env.AI` binding, a `@cf/meta/llama-*` model); no Anthropic key, consistent with `ai-subtasks.js` / `nl-filter.js`.
- [ ] The confidence threshold that triggers the fallback is defined and documented in the code.
- [ ] Handler test where a messy message routes to a faked model call (no real network call in tests).

## Blocked by

- 02 — Inbound capture: text → task
