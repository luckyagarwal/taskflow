# Sub-projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Nest a project one level under a parent, shown indented with expand/collapse in both sidebars.

**Architecture:** Pure nesting logic in a new `src/projects.js` (unit-tested). Store (`src/store.jsx`) gains a `parent` param + delete-promotion + group-inheritance + `setProjectParent`. Sidebars (`src/App.jsx`, `src/MobileApp.jsx`) render via `orderedProjectsForSection` and add a parent picker. Sync/schema unchanged (blob storage).

**Tech Stack:** React (hooks), plain ES modules, `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-21-sub-projects-design.md`

---

## Task 1: Pure nesting helpers + tests (`src/projects.js`)

**Files:** Create `src/projects.js`, create `tests/projects.test.mjs`.

- [ ] **Step 1: Write the test file** `tests/projects.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  topLevelProjects, childrenOf, hasChildren,
  eligibleParents, canSetParent, promoteChildrenOnDelete,
  orderedProjectsForSection,
} from "../src/projects.js";

const mk = (id, o = {}) => ({ id, name: id, group: "Work", parent: null, position: 0, ...o });

test("topLevelProjects: only parent==null, sorted by position", () => {
  const ps = [mk("a", { position: 2 }), mk("b", { position: 0 }), mk("c", { parent: "b", position: 1 })];
  assert.deepEqual(topLevelProjects(ps).map((p) => p.id), ["b", "a"]);
});

test("childrenOf: children of a parent sorted by position", () => {
  const ps = [mk("p"), mk("x", { parent: "p", position: 1 }), mk("y", { parent: "p", position: 0 })];
  assert.deepEqual(childrenOf(ps, "p").map((p) => p.id), ["y", "x"]);
});

test("hasChildren", () => {
  const ps = [mk("p"), mk("c", { parent: "p" }), mk("lonely")];
  assert.equal(hasChildren(ps, "p"), true);
  assert.equal(hasChildren(ps, "lonely"), false);
});

test("eligibleParents: top-level, excludes self, [] when self has children", () => {
  const ps = [mk("a"), mk("b"), mk("c", { parent: "b" })];
  assert.deepEqual(eligibleParents(ps, "a").map((p) => p.id).sort(), ["b"]);
  // 'b' has a child 'c' → b is still a valid parent for others, but giving b a parent is blocked:
  assert.deepEqual(eligibleParents(ps, "b"), []);
});

test("canSetParent: guards", () => {
  const ps = [mk("a"), mk("b"), mk("c", { parent: "b" })];
  assert.equal(canSetParent(ps, "a", null), true);   // detach always ok
  assert.equal(canSetParent(ps, "a", "a"), false);    // self
  assert.equal(canSetParent(ps, "a", "b"), true);     // valid: b is top-level
  assert.equal(canSetParent(ps, "a", "c"), false);    // c is not top-level
  assert.equal(canSetParent(ps, "b", "a"), false);    // b has children → would be 2 levels
});

test("promoteChildrenOnDelete: children get parent=null; none → []", () => {
  const ps = [mk("p"), mk("c1", { parent: "p" }), mk("c2", { parent: "p" }), mk("q")];
  const promoted = promoteChildrenOnDelete(ps, "p");
  assert.deepEqual(promoted.map((p) => [p.id, p.parent]), [["c1", null], ["c2", null]]);
  assert.deepEqual(promoteChildrenOnDelete(ps, "q"), []);
});

test("orderedProjectsForSection: parent then its children, depth-tagged, filtered by group", () => {
  const ps = [
    mk("top1", { group: "Work", position: 0 }),
    mk("kid", { group: "Work", parent: "top1", position: 0 }),
    mk("top2", { group: "Work", position: 1 }),
    mk("other", { group: "Personal", position: 0 }),
  ];
  const rows = orderedProjectsForSection(ps, "Work");
  assert.deepEqual(rows.map((r) => [r.project.id, r.depth]), [["top1", 0], ["kid", 1], ["top2", 0]]);
});
```

- [ ] **Step 2: Run, verify fail** — `node --test tests/projects.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/projects.js`:

```js
// src/projects.js — pure helpers for one-level project nesting.
// No React. Unit-tested in tests/projects.test.mjs.

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

export function topLevelProjects(projects) {
  return projects.filter((p) => !p.parent).slice().sort(byPosition);
}

export function childrenOf(projects, parentId) {
  return projects.filter((p) => p.parent === parentId).slice().sort(byPosition);
}

export function hasChildren(projects, projectId) {
  return projects.some((p) => p.parent === projectId);
}

// Top-level projects that may serve as a parent for `projectId`.
// Empty if `projectId` itself has children (one-level rule).
export function eligibleParents(projects, projectId) {
  if (hasChildren(projects, projectId)) return [];
  return topLevelProjects(projects).filter((p) => p.id !== projectId);
}

// Guard for assigning `parentId` to `childId`. null detaches (always allowed).
export function canSetParent(projects, childId, parentId) {
  if (parentId == null) return true;
  if (childId === parentId) return false;
  if (hasChildren(projects, childId)) return false; // would create a 2nd level
  const parent = projects.find((p) => p.id === parentId);
  if (!parent) return false;
  if (parent.parent) return false; // parent must itself be top-level
  return true;
}

// Children of a to-be-deleted project, patched to top-level.
export function promoteChildrenOnDelete(projects, deletedId) {
  return childrenOf(projects, deletedId).map((c) => ({ ...c, parent: null }));
}

// Flat render list for one sidebar section: each top-level project in the
// group, immediately followed by its children. Items are { project, depth }.
export function orderedProjectsForSection(projects, groupName) {
  const out = [];
  for (const top of topLevelProjects(projects).filter((p) => p.group === groupName)) {
    out.push({ project: top, depth: 0 });
    for (const child of childrenOf(projects, top.id)) {
      out.push({ project: child, depth: 1 });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass** — `node --test tests/projects.test.mjs` → all pass. Then `npm test` → full suite green.

- [ ] **Step 5: Commit** — `git add src/projects.js tests/projects.test.mjs && git commit -m "feat(projects): pure one-level nesting helpers + tests"` (add Co-Authored-By trailer).

---

## Task 2: Store wiring (`src/store.jsx`)

**Files:** Modify `src/store.jsx`. Read the file first; integrate against the real code.

Behaviour to implement (use the Task 1 helpers; import from `./projects.js`):

- [ ] **`addProject(name, group = 'Personal', parent = null)`** — accept `parent`. If `parent` is set, look up the parent project and force `group = parent.group` before building the record. Store `parent` (default `null`) instead of the hard-coded `null`. Keep `queueSave` + `setView` behaviour.
- [ ] **`deleteProject(id)`** — before removing, compute `promoteChildrenOnDelete(projects, id)`; apply those patches to local state and `queueSave({ projects: promotedChildren })` so the children become top-level. Keep the existing task-orphaning of the deleted project's own tasks.
- [ ] **Group inheritance** — wherever a top-level project's `group` changes (`updateProject` when `patch.group` differs; `updateSection` rename path; `reorderProjects` cross-section move), also update every `childrenOf(projects, thatId)` to the new group and `queueSave` them. Factor a small local helper `cascadeGroupToChildren(projectId, newGroup)` to avoid duplication.
- [ ] **`setProjectParent(childId, parentId)`** — new action exposed from the store context: if `canSetParent(projects, childId, parentId)` is false, no-op (optionally toast). Otherwise set the child's `parent`, and if `parentId` set, also set the child's `group` to the parent's group. `queueSave` the changed child.
- [ ] Export `setProjectParent` through the same context/value object the other project actions use.

**Test/verify:** No new unit test (store is React). Run `npm test` (must stay green) and `npm run build` (must succeed). Manually reason through: creating with parent inherits group; deleting parent promotes children.

- [ ] **Commit** — `git add src/store.jsx && git commit -m "feat(projects): store support for nesting (parent param, delete-promotion, group inheritance, setProjectParent)"`.

---

## Task 3: Desktop sidebar (`src/App.jsx`)

**Files:** Modify `src/App.jsx`. Read `ProjectGroup` (~L90) and `Sidebar` (~L254) first.

- [ ] Replace the flat `projects.filter(p => p.group === sec.name).map(...)` rendering with `orderedProjectsForSection(projects, sec.name)` (import from `../src/projects.js` — adjust relative path to `./projects.js`). Render each row's `project`; apply a left indent when `depth === 1` (e.g. add `style={{ paddingLeft: depth ? 28 : undefined }}` or a `nav-item--child` class — match existing class conventions).
- [ ] On parent rows (`depth === 0` AND `hasChildren(projects, project.id)`), render an expand/collapse caret using the **existing** collapse pattern in the store (the `expandedIds`/collapse state already used elsewhere). When collapsed, skip that parent's child rows. Reuse existing toggle action; do not invent a new persistence mechanism.
- [ ] Add a **parent picker** to project creation/rename: when creating a project (the existing add-project affordance) and when editing one, offer a `<select>` populated from `eligibleParents(projects, projectId)` plus a "None (top-level)" option, wired to `addProject(..., parent)` on create and `setProjectParent(id, parent)` on change. Keep it consistent with the existing inline-edit UI; a minimal dropdown is fine.

**Verify:** `npm run build` succeeds. Code review confirms tree renders and picker calls the right actions.

- [ ] **Commit** — `git add src/App.jsx && git commit -m "feat(projects): desktop sidebar nesting (indented tree, caret, parent picker)"`.

---

## Task 4: Mobile sidebar + add-project modal (`src/MobileApp.jsx`)

**Files:** Modify `src/MobileApp.jsx`. Read `BrowseView` (~L134) and `AddProjectModal` (~L451) first.

- [ ] In `BrowseView`, replace the flat per-section `projects.filter(...).map(...)` with `orderedProjectsForSection(projects, sec.name)`; indent `depth === 1` rows; show a caret + collapse on parents with children (reuse the same collapse state as desktop).
- [ ] In `AddProjectModal`, add a parent `<select>` ("None (top-level)" + `eligibleParents`), and pass the chosen parent into `addProject(name, group, parent)`.

**Verify:** `npm run build` succeeds.

- [ ] **Commit** — `git add src/MobileApp.jsx && git commit -m "feat(projects): mobile sidebar nesting + parent picker in add-project modal"`.

---

## Task 5: Final verification

- [ ] `npm test` → all green (parse + projects + sync + storage + sw).
- [ ] `npm run build` → succeeds, no errors.
- [ ] Push: `git push origin main`.

---

## Self-Review

- Spec decisions → tasks: one-level guard (`canSetParent`, T1), parent picker (T3/T4), group-follows-parent (T2 addProject + cascade), delete-promotion (T2 + `promoteChildrenOnDelete` T1), direct counts (unchanged — no task touches counts ✓), expand/collapse reusing existing state (T3/T4). All covered.
- No placeholders in Task 1 (full code + tests). Tasks 2–4 are integration into large existing files; they specify the exact helper API, behaviour, and acceptance, and instruct reading the file first — appropriate for unseen JSX rather than guessing line-exact diffs.
- Type consistency: helper names (`orderedProjectsForSection`, `eligibleParents`, `canSetParent`, `promoteChildrenOnDelete`, `hasChildren`, `childrenOf`, `topLevelProjects`) match between `src/projects.js`, the tests, and the wiring tasks. New store action `setProjectParent(childId, parentId)` named consistently in T2 and T3.
- Known limitation stated in spec: no component tests; UI verified by build + review.
