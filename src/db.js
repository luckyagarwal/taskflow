// src/db.js — Local source of truth (IndexedDB via Dexie).
//
// This is the offline-first foundation: the UI reads and writes here first and
// never blocks on the network. A background sync engine (sync.js) reconciles
// this store with the authoritative Cloudflare D1 backend.
//
// Stores:
//   tasks/projects/labels/sections — mirror the server records. Each row carries
//     `updatedAt` (client epoch ms, drives last-write-wins) and `deleted` (0/1
//     tombstone so deletions can propagate via incremental sync).
//   outbox — pending local mutations not yet confirmed by the server. Keyed by
//     `${table}:${recordId}` so repeated edits to the same record coalesce into a
//     single pending op instead of growing unbounded.
//   meta — key/value; holds `syncToken` (the max server `updatedAt` seen so far,
//     used as the `?since=` watermark for incremental pulls).
import Dexie from 'dexie';

export const db = new Dexie('taskflow');

db.version(1).stores({
  tasks: 'id, updatedAt, deleted',
  projects: 'id, updatedAt, deleted',
  labels: 'id, updatedAt, deleted',
  sections: 'id, updatedAt, deleted',
  outbox: '&key, table, recordId',
  meta: '&key',
});

export const RECORD_TABLES = ['tasks', 'projects', 'labels', 'sections'];
