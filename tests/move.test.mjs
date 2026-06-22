import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveTask } from '../src/move.js';

const mk = (ids) => ids.map((id, i) => ({ id, position: i, dueOffset: 0, status: 'planned' }));

test('reorder within a zone: move A before C, positions become dense', () => {
  const out = moveTask(mk(['A', 'B', 'C', 'D']), 'A', {}, 'C');
  assert.deepEqual(out.map((t) => t.id), ['B', 'A', 'C', 'D']);
  assert.deepEqual(out.map((t) => t.position), [0, 1, 2, 3]);
});

test('cross-day move: patch dueOffset and insert before target', () => {
  const out = moveTask(mk(['A', 'B', 'C']), 'C', { dueOffset: 3 }, 'B');
  assert.deepEqual(out.map((t) => t.id), ['A', 'C', 'B']);
  assert.equal(out.find((t) => t.id === 'C').dueOffset, 3);
  assert.equal(out.find((t) => t.id === 'A').dueOffset, 0); // others untouched
});

test('drop at end of zone (beforeId null): moved gets the highest position', () => {
  const out = moveTask(mk(['A', 'B', 'C']), 'A', { dueOffset: 5 }, null);
  assert.deepEqual(out.map((t) => t.id), ['B', 'C', 'A']);
  assert.equal(out[out.length - 1].id, 'A');
  assert.equal(out[out.length - 1].position, 2);
});

test('status patch is applied to the moved task only', () => {
  const patch = { status: 'done', done: true, doneOffset: 0 };
  const out = moveTask(mk(['A', 'B']), 'A', patch, null);
  const a = out.find((t) => t.id === 'A');
  assert.equal(a.status, 'done');
  assert.equal(a.done, true);
  assert.equal(out.find((t) => t.id === 'B').status, 'planned');
});

test('unknown dragged id returns the input unchanged', () => {
  const input = mk(['A', 'B']);
  const out = moveTask(input, 'Z', { dueOffset: 1 }, 'A');
  assert.equal(out, input);
});

test('unknown beforeId falls back to appending at the end', () => {
  const out = moveTask(mk(['A', 'B']), 'A', {}, 'ghost');
  assert.deepEqual(out.map((t) => t.id), ['B', 'A']);
});
