// Storage layer tests: local repo (outbox + LWW merge) and server incremental
// sync (delta pulls, tombstones, last-write-wins guard).
import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as repo from '../src/repo.js';
import { onRequestGet as onDataGet } from '../functions/api/data.js';
import { onRequestPost as onSavePost, onRequestDelete as onSaveDelete } from '../functions/api/save.js';
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

test('reset (DELETE /api/save) tombstones rows so the wipe propagates to other devices', async () => {
  const store = new Map();
  const t0 = Date.now() - 10000;

  // A record previously synced from another device.
  await onSavePost(makeCtx(store, '/api/save', 'POST', { upserts: { projects: [{ id: 'p_old', name: 'Old', updatedAt: t0 }] } }));

  // Reset.
  const res = await onSaveDelete(makeCtx(store, '/api/save', 'DELETE'));
  assert.equal((await res.json()).success, true);

  // Full snapshot is empty (live rows only).
  let body = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(body.projects.length, 0);

  // But an incremental pull since the old watermark returns a TOMBSTONE, so a
  // device still holding p_old learns to delete it (instead of resurrecting it).
  body = await (await onDataGet(makeCtx(store, `/api/data?since=${t0}`, 'GET'))).json();
  const tomb = body.projects.find((p) => p.id === 'p_old');
  assert.ok(tomb && tomb.deleted === 1, 'old record is tombstoned, not silently hard-deleted');
});

// ── Reset generation: a wipe must beat un-synced data on every device ──────
// Tombstones alone can't cover rows the server has never seen (an offline
// device's outbox). A monotonic reset generation lets the server reject any
// write minted in a pre-reset world, so a reset can't be resurrected.

test('GET /api/data reports the current reset generation', async () => {
  const store = new Map();

  let body = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(body.generation, 0, 'fresh server starts at generation 0');

  await onSaveDelete(makeCtx(store, '/api/save', 'DELETE'));

  body = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(body.generation, 1, 'reset is observable to other devices via the pulled generation');
});

test('after reset, a write carrying a stale generation is rejected (no resurrection)', async () => {
  const store = new Map();
  const t0 = Date.now() - 10000;

  // Device B had previously synced a project in the generation-0 world.
  await onSavePost(makeCtx(store, '/api/save', 'POST', {
    upserts: { projects: [{ id: 'p_old', name: 'Old', updatedAt: t0 }] }, generation: 0,
  }));

  // Reset from device A bumps the server generation to 1.
  const delBody = await (await onSaveDelete(makeCtx(store, '/api/save', 'DELETE'))).json();
  assert.equal(delBody.generation, 1, 'reset bumps the server generation');

  // Device B, still living in generation 0, flushes its outbox: a row the server
  // has never seen (never-synced) plus a re-push of p_old, both with fresh
  // timestamps that would otherwise win last-write-wins.
  await onSavePost(makeCtx(store, '/api/save', 'POST', {
    upserts: {
      tasks: [{ id: 't_zombie', title: 'Zombie', updatedAt: Date.now() }],
      projects: [{ id: 'p_old', name: 'Old', updatedAt: Date.now() }],
    },
    generation: 0,
  }));

  const snap = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(snap.tasks.length, 0, 'never-synced row is NOT resurrected onto a reset server');
  assert.equal(snap.projects.length, 0, 'stale re-push does NOT resurrect a wiped project');
});

test('a write carrying the current generation is accepted after a reset', async () => {
  const store = new Map();
  await onSaveDelete(makeCtx(store, '/api/save', 'DELETE')); // generation → 1

  await onSavePost(makeCtx(store, '/api/save', 'POST', {
    upserts: { sections: [{ id: 'sec1', name: 'New', updatedAt: Date.now() }] }, generation: 1,
  }));

  const snap = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(snap.sections.length, 1, 'a current-generation create after reset is kept');
});

test('a legacy write with no generation field is still accepted (back-compat)', async () => {
  const store = new Map();
  await onSavePost(makeCtx(store, '/api/save', 'POST', {
    upserts: { tasks: [{ id: 't1', title: 'A', updatedAt: Date.now() }] },
  }));
  const snap = await (await onDataGet(makeCtx(store, '/api/data', 'GET'))).json();
  assert.equal(snap.tasks.length, 1, 'omitted generation is not treated as stale');
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
