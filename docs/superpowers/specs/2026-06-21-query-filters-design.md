# Saved filters + query language — design

**Date:** 2026-06-21 · **Feature:** C (final of the batch; A,B,D,E,F done). The absolute-date bug originally bundled here was fixed in feature A.

## Goal

A text query (`p1 & overdue`, `@email | today`) that filters tasks live, savable by name, plus a natural-language mode ("show me urgent work tasks") that reuses the AI endpoint pattern.

## Background (verified)

- `FiltersView` (`views.jsx:701`) is today only a labels grid — no query/saved-filter concept exists.
- Task fields: `priority` 1–4, `dueOffset` (number|null|'someday'; <0 overdue), `status` (planned/inprogress/blocked/waiting/done), `labels` (id[]), `projectId` ('inbox' or id), `done`, `recurring`. `Sel` selectors at `store.jsx:926`.
- Labels `{id,name,color}`, projects `{id,name,...}`; resolve name→id from the live `labels`/`projects` arrays (`useApp()`), not the static `H.*ById`.
- Persistence: localStorage already used for theme/density/sorts/filters (`store.jsx:34–74`); `queueSave`→Dexie→D1 for synced tables. `meta` table holds only the sync token.
- `TaskGroup` (`views.jsx:11`) is the universal list renderer; TodayView (`views.jsx:429`) shows the compile-predicate→filter→`TaskGroup` pattern.
- View routing: `case 'filters'`/`'label'` in both `App.jsx:426` and `MobileApp.jsx:342`; sidebar nav `App.jsx:372`, mobile Browse card `MobileApp.jsx:218`.
- AI pattern: `functions/api/ai-subtasks.js` + pure `functions/api/_ai.js` (reads `env.ANTHROPIC_API_KEY`, 503 when unset, `output_config.format` json_schema).

## Decisions (defaults)

1. **Query DSL** (case-insensitive):
   - priority `p1 p2 p3 p4`; due `overdue today upcoming nodate someday`; status `planned inprogress blocked waiting done recurring`; `@labelname`, `#projectname`, `inbox`.
   - operators `&` (and), `|` (or), `!` (not), `(` `)`; **whitespace = implicit AND**.
   - `@name`/`#name` resolve by comparing the name with spaces removed, lowercased (so `@deepwork` matches "deep work"). Unresolvable name → matches nothing (predicate false), not an error.
   - Unknown bare term → compile error surfaced inline; the list isn't filtered to garbage.
2. **Default scope:** the view applies the predicate to **active (non-done) tasks** unless the query references `done` (`compileQuery` returns a `usesDone` flag); then it applies to all tasks. Matches Todoist's "filters hide completed unless asked".
3. **Saved filters in localStorage** (`todo-proto-saved-filters`), shape `{id,name,query}`. Device-local. (Cross-device sync via a Dexie table is a future enhancement — avoided here to skip a schema/sync migration.)
4. **Natural-language mode:** `functions/api/nl-filter.js` POST `{text, labels:[{name}], projects:[{name}]}` → `{query: string}` (a DSL string). The UI drops the result into the editable query bar and compiles it with `src/query.js` — one evaluator, transparent and correctable. 503-graceful, identical to the subtasks endpoint.
5. **UI:** FiltersView gets a query bar (live result via `TaskGroup`) + "Save" (prompts a name) + an "Ask in words" button (NL mode). Saved filters render in the desktop sidebar under Filters and in mobile Browse; selecting one opens `{type:'saved-filter', id}` which compiles+renders. **Both surfaces.**

## Architecture

- **`src/query.js`** (pure, tested): `compileQuery(str, {labels, projects})` → `{ok, predicate, usesDone, error, empty}`. Tokenizer + recursive-descent parser (`|` < `&`/implicit-AND < `!` < atom/parens).
- **`functions/api/_ai.js`**: add `buildFilterPrompt(text, labels, projects)` and `parseFilterQuery(text)` (pure, tested).
- **`functions/api/nl-filter.js`**: route mirroring `ai-subtasks.js` (model constant, 503-graceful, json_schema `{query}`).
- **store**: `savedFilters` state + `addSavedFilter(name, query)` / `deleteSavedFilter(id)`, persisted to localStorage; exposed via context.
- **views/App/MobileApp**: query bar in FiltersView, `SavedFilterView`, `case 'saved-filter'` in both routers, sidebar + Browse listings.
- No Dexie/sync/schema change.

## Out of scope

Cross-device sync of saved filters, sort-within-filter, query autocomplete, saved-filter reordering, date-math operators (`due:<3d`).

## Testing

`tests/query.test.mjs` (`node --test`) over `src/query.js`:
- single terms: `p1`, `overdue`, `today`, `upcoming`, `nodate`, `done` (sets usesDone), a status, `recurring`, `inbox`.
- `@label` resolves via spaces-removed match; unknown label → matches nothing (ok, not error).
- `#project` resolves; `#inbox` → inbox.
- operators: `p1 & overdue`, `p1 | p2`, `!done`, `(p1 | p2) & today`, implicit AND `p1 overdue`.
- errors: unknown term → `ok:false` with error; unbalanced `(` → error.
- empty string → `empty:true`, predicate matches all.

`tests/ai.test.mjs` additions: `buildFilterPrompt` includes the request text + label/project names + grammar; `parseFilterQuery` extracts `{query}`, returns '' on bad JSON, clamps length.

Route network call + UI verified by `npm run build` + review. Acknowledged.

## Acceptance

- Typing `p1 & overdue` in the Filters query bar shows only overdue P1 tasks; `done` is hidden unless the query says `done`.
- A query can be saved with a name and reopened from the sidebar (desktop) and Browse (mobile).
- "Ask in words" with the key set fills the bar with a DSL query; with no key it shows "AI isn't set up".
- New unit tests pass; full suite green; build succeeds.
