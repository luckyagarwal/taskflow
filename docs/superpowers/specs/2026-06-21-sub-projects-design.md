# Sub-projects (nested projects) — design

**Date:** 2026-06-21
**Feature:** B (parity batch). Order: A done, **B now**, then D, E, F, C.

## Goal

Let a project be nested under another project ("parent"), shown indented in the sidebar with an expand/collapse caret, on both desktop and mobile.

## Background (verified in code)

- Projects are `{ id, name, color, group, parent, position }` (`src/store.jsx` `addProject` ~L442). `parent` is hard-coded `null` and **never read** — fully dead today.
- `group` is a sidebar **section** label ("Work", "Personal"); a parallel `sections` array drives section rendering. Sidebar renders projects as a flat `projects.filter(p => p.group === sec.name).map(...)` in both `src/App.jsx` (`ProjectGroup`/`Sidebar`) and `src/MobileApp.jsx` (`BrowseView`).
- Persistence/sync is **blob-based** (`repo.js`, `sync.js`, `schema.sql` store the whole project JSON). Using `parent` needs **zero** schema/sync changes.
- `updateProject(id, patch)` is field-agnostic — `{ parent }` already round-trips.
- Counts: `Sel.byProject(tasks, p.id).length` (direct match only) in both sidebars.

## Decisions (defaults chosen for minimal risk)

1. **One level of nesting only.** A parent must itself be top-level (`parent == null`). A project that already has children cannot be given a parent. This prevents cycles and keeps delete, counts, and rendering trivial. Multi-level nesting is a future extension.
2. **`group` follows the parent.** A child's `group` is forced equal to its parent's `group` on create and whenever the parent's group changes (rename/move). Nesting is *within* a section, not across sections.
3. **Set parent via a picker** in the create-project and edit-project UI (desktop + mobile). Options: "None (top-level)" plus every eligible top-level project. Drag-to-reparent is out of scope.
4. **Delete a parent → promote children to top-level** (`parent = null`, keep their `group`). The parent's own tasks orphan to Inbox (`projectId = null`) exactly as today. No child project is deleted.
5. **Counts stay direct.** Each project (parent or child) shows only its own directly-assigned tasks. No roll-up. `ProjectView` is unchanged (direct tasks only).
6. **Expand/collapse.** A parent with children gets a caret; collapsing hides its children. Collapse state is per-parent, held in existing client UI state (not synced) — reuse the existing `expandedIds`-style pattern already in the store.

## Architecture

New pure module **`src/projects.js`** (no React) holding all nesting logic, so it is unit-testable with the existing `node --test` runner:

- `childrenOf(projects, parentId)` → children sorted by `position`.
- `topLevelProjects(projects)` → `parent == null`, sorted by `position`.
- `eligibleParents(projects, projectId)` → top-level projects, excluding `projectId` itself and excluding any project that currently has children (so the result is only valid one-level parents). Used to populate the picker.
- `canSetParent(projects, childId, parentId)` → boolean guard: `parentId` must be top-level, `childId !== parentId`, and `childId` must not itself have children. Enforces decision #1.
- `promoteChildrenOnDelete(projects, deletedId)` → array of patched child records with `parent = null` (decision #4).
- `orderedProjectsForSection(projects, groupName)` → flat render list of `{ project, depth }` for one section: each top-level project in that group followed immediately by its children (depth 1), all by `position`. Drives both sidebars.

Store changes (`src/store.jsx`):
- `addProject(name, group, parent = null)` — accept and store `parent`; if `parent` set, force `group` to the parent's group.
- `deleteProject(id)` — before removing, apply `promoteChildrenOnDelete` and `queueSave` the promoted children.
- When a parent's `group` changes (in `updateProject` and in `updateSection` rename / `reorderProjects` cross-section move), propagate the new group to its children.
- Expose a `setProjectParent(childId, parentId)` action that validates via `canSetParent`, sets `parent`, and syncs.

UI changes:
- `src/App.jsx`: `Sidebar`/`ProjectGroup` render via `orderedProjectsForSection`, indenting depth-1 rows and adding a caret on parents. Parent picker added to the create/rename project affordance.
- `src/MobileApp.jsx`: `BrowseView` renders indented children; `AddProjectModal` gets a parent `<select>`.

## Out of scope

Multi-level nesting, drag-to-reparent, count roll-up to parents, showing descendant tasks in a parent's ProjectView.

## Testing

Unit tests (`tests/projects.test.mjs`, `node --test`) cover every `src/projects.js` helper:
- `childrenOf` / `topLevelProjects` ordering by position.
- `eligibleParents` excludes self, excludes projects that have children, lists only top-level.
- `canSetParent`: rejects self-parent, rejects a non-top-level parent, rejects when the child has children; accepts a valid case.
- `promoteChildrenOnDelete`: returns children with `parent = null` and unchanged otherwise; returns `[]` when the deleted project has no children.
- `orderedProjectsForSection`: parent followed by its children with correct depth, filtered to the section, ordered by position.

UI wiring is verified by `npm run build` succeeding and code review (no component test harness exists in this repo; existing tests are pure-logic only). This limitation is acknowledged, not hidden.

## Acceptance

- Creating a project with a parent shows it indented under the parent in both sidebars.
- The parent picker only offers valid one-level parents; cycles/self/grandchildren are impossible.
- Deleting a parent promotes its children to top-level; no child is lost.
- Renaming/moving a parent's section moves its children with it.
- All new unit tests pass; full suite stays green; `npm run build` succeeds.
