// Guards against the regression where the service worker cached /api/* requests,
// serving stale cross-device data and breaking the SSE live-sync stream. The SW
// must let every /api/ request pass straight to the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('service worker bypasses /api/ before any caching logic', () => {
  const bypassIdx = sw.indexOf("pathname.startsWith('/api/')");
  const cacheMatchIdx = sw.indexOf('caches.match');

  assert.ok(bypassIdx !== -1, 'sw.js must early-return for /api/ requests');
  assert.ok(cacheMatchIdx !== -1, 'sanity: sw.js still caches non-API assets');
  assert.ok(
    bypassIdx < cacheMatchIdx,
    'the /api/ bypass must run before any cache lookup, so API calls are never served from cache'
  );
});
