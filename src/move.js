// src/move.js — pure task move/reorder used by the pointer-drag system.
//
// A "move" is a reorder plus an optional field patch (the new day or status).
// It removes the dragged task, applies the patch, inserts it before `beforeId`
// (or at the end when `beforeId` is null/unknown), then reassigns a dense
// `position` to every task — the same ordering scheme the store sorts by.
export function moveTask(tasks, draggedId, patch = {}, beforeId = null) {
  const next = [...tasks];
  const dragIdx = next.findIndex((t) => t.id === draggedId);
  if (dragIdx === -1) return tasks;

  let [moved] = next.splice(dragIdx, 1);
  if (patch && Object.keys(patch).length) moved = { ...moved, ...patch };

  let insertIdx = next.length;
  if (beforeId != null) {
    const i = next.findIndex((t) => t.id === beforeId);
    if (i !== -1) insertIdx = i;
  }
  next.splice(insertIdx, 0, moved);

  return next.map((t, i) => ({ ...t, position: i }));
}
