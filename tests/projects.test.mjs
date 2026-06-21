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
  assert.deepEqual(eligibleParents(ps, "b"), []);
});

test("canSetParent: guards", () => {
  const ps = [mk("a"), mk("b"), mk("c", { parent: "b" })];
  assert.equal(canSetParent(ps, "a", null), true);
  assert.equal(canSetParent(ps, "a", "a"), false);
  assert.equal(canSetParent(ps, "a", "b"), true);
  assert.equal(canSetParent(ps, "a", "c"), false);
  assert.equal(canSetParent(ps, "b", "a"), false);
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
