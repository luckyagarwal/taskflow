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
  // A null/undefined id is not a real project, so it has no children. Without
  // this guard `hasChildren(projects, null)` would be true whenever any
  // top-level project exists (those store parent === null), which breaks the
  // create-project parent picker that calls eligibleParents(projects, null).
  if (projectId == null) return false;
  return projects.some((p) => p.parent === projectId);
}

export function eligibleParents(projects, projectId) {
  if (hasChildren(projects, projectId)) return [];
  return topLevelProjects(projects).filter((p) => p.id !== projectId);
}

export function canSetParent(projects, childId, parentId) {
  if (parentId == null) return true;
  if (childId === parentId) return false;
  if (hasChildren(projects, childId)) return false;
  const parent = projects.find((p) => p.id === parentId);
  if (!parent) return false;
  if (parent.parent) return false;
  return true;
}

export function promoteChildrenOnDelete(projects, deletedId) {
  return childrenOf(projects, deletedId).map((c) => ({ ...c, parent: null }));
}

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
