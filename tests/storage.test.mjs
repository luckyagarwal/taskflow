// Storage layer tests: local repo (outbox + LWW merge) and server incremental
// sync (delta pulls, tombstones, last-write-wins guard).
import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as repo from '../src/repo.js';
import { onRequestGet as onDataGet } from '../functions/api/data.js';
import { onRequestPost as onSavePost } from '../functions/api/save.js';
import { makeFakeD1 } from './fakeD1.mjs';

// ── Local repository (Dexie via fake-indexeddb) ───────────────────────────

beforeEach(async () => {
  await repo.clearAll();
});

test('putRecord persists locally and queues an upsert op', async () => {
  await repo.putRecord('tasks', { id: 't1', title: 'A' });

  const local = await repo.loadAll();
  assert.equal(local.tasks.length, 1);
  assert.equal(local.tasks[0].title, 'A');
  assert.equal(typeof local.tasks[0].updatedAt, 'number');

  const outbox = await repo.getOutbox();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].op, 'upsert');
  assert.equal(outbox[0].recordId, 't1');
});

test('removeRecord soft-deletes locally and queues a delete op', async () => {
  await repo.putRecord('tasks', { id: 't1', title: 'A' });
  await repo.removeRecord('tasks', 't1');

  const local = await repo.loadAll();
  assert.equal(local.tasks.length, 0, 'tombstoned record is hidden from loadAll');

  const op = (await repo.getOutbox()).find((o) => o.recordId === 't1');
  assert.equal(op.op, 'delete');
});

test('repeated edits to one record coalesce into a single outbox op', async () => {
  await repo.putRecord('tasks', { id: 't1', title: 'A' });
  await repo.putRecord('tasks', { id: 't1', title: 'B' });
  await repo.putRecord('tasks', { id: 't1', title: 'C' });

  const outbox = await repo.getOutbox();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].payload.title, 'C');
});

test('applyServerRecords skips records with a pending local op', async () => {
  await repo.putRecord('tasks', { id: 't1', title: 'local' }); // leaves pending op
  await repo.applyServerRecords({ tasks: [{ id: 't1', title: 'server', updatedAt: 9e15, deleted: 0 }] });

  const local = await repo.loadAll();
  assert.equal(local.tasks[0].title, 'local', 'in-flight local edit wins');
});

test('applyServerRecords applies newer and rejects older (LWW)', async () => {
  await repo.putRecord('tasks', { id: 't1', title: 'local' });
  await repo.clearOutboxEntries(await repo.getOutbox()); // simulate confirmed/flushed
  const localTs = (await repo.loadAll()).tasks[0].updatedAt;

  // Older server record → rejected.
  await repo.applyServerRecords({ tasks: [{ id: 't1', title: 'stale', updatedAt: localTs - 1, deleted: 0 }] });
  assert.equal((await repo.loadAll()).tasks[0].title, 'local');

  // Newer server record → applied.
  await repo.applyServerRecords({ tasks: [{ id: 't1', title: 'fresh', updatedAt: localTs + 1, deleted: 0 }] });
  assert.equal((await repo.loadAll()).tasks[0].title, 'fresh');
});

// ── Server incremental sync (data.js + save.js over fake D1) ──────────────

function makeCtx(store, url, method, bodyObj) {
  const init = { method };
  if (bodyObj !== undefined) init.body = JSON.stringify(bodyObj);
  return { request: new Request('http://localhost' + url, init), env: { DB: makeFakeD1(store) } };
}

test('incremental ?since returns only changed rows including tombstones', async () => {
  const store = new Map();
  // Use realistic epoch-ms timestamps so the 30-day tombstone purge leaves them.
  const t1 = Date.now();
  const t2 = t1 + 1000;

  await onSavePost(makeCtx(store, '/api/save', 'POST', { upserts: { tasks: [{ id: 't1', title: 'A', updatedAt: t1 }] } }));

  let res = await onDataGet(makeCtx(store, `/api/data?since=${t1 - 1}`, 'GET'));
  let body = await res.json();
  assert.equal(body.tasks.length, 1);
  assert.equal(body.tasks[0].updatedAt, t1);
  assert.equal(body.serverMax, t1);

  // Soft-delete with a newer client timestamp.
  await onSavePost(makeCtx(store, '/api/save', 'POST', { deletes: { tasks: [{ id: 't1', updatedAt: t2 }] } }));

  res = await onDataGet(makeCtx(store, `/api/data?since=${t1}`, 'GET'));
  body = await res.json();
  assert.equal(body.tasks.length, 1, 'tombstone is returned to incremental pull');
  assert.equal(body.tasks[0].deleted, 1);
  assert.equal(body.serverMax, t2);

  // Full snapshot excludes the tombstone.
  res = await onDataGet(makeCtx(store, '/api/data', 'GET'));
  body = await res.json();
  assert.equal(body.tasks.length, 0);
});

test('save reaps tombstones past the retention window but keeps recent ones', async () => {
  const store = new Map();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Seed: an old tombstone (40d), a recent tombstone (1d), and a live record.
  store.set('tasks|old', { table: 'tasks', id: 'old', data: '', updated_at: now - 40 * day, deleted: 1 });
  store.set('tasks|recent', { table: 'tasks', id: 'recent', data: '', updated_at: now - day, deleted: 1 });
  store.set('tasks|live', { table: 'tasks', id: 'live', data: JSON.stringify({ id: 'live', title: 'L' }), updated_at: now, deleted: 0 });

  // Any save triggers the batched purge.
  await onSavePost(makeCtx(store, '/api/save', 'POST', { upserts: {} }));

  assert.equal(store.has('tasks|old'), false, 'tombstone older than 30d is reaped');
  assert.equal(store.has('tasks|recent'), true, 'recent tombstone is retained for offline devices');
  assert.equal(store.has('tasks|live'), true, 'live record is untouched');
});

test('server rejects a stale write (older client timestamp)', async () => {
  const store = new Map();
  await onSavePost(makeCtx(store, '/api/save', 'POST', { upserts: { tasks: [{ id: 't1', title: 'new', updatedAt: 5000 }] } }));
  // A delayed, stale write arrives with an older timestamp.
  await onSavePost(makeCtx(store, '/api/save', 'POST', { upserts: { tasks: [{ id: 't1', title: 'stale', updatedAt: 100 }] } }));

  const res = await onDataGet(makeCtx(store, '/api/data', 'GET'));
  const body = await res.json();
  assert.equal(body.tasks[0].title, 'new', 'stale write did not clobber newer record');
});
