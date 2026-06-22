import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRemindAt } from "../shared/compute.js";

// A fixed "now" so the relative-offset math is deterministic.
// 2026-06-22 06:00 UTC == 2026-06-22 11:30 IST (Asia/Kolkata, +05:30).
const NOW = Date.UTC(2026, 5, 22, 6, 0, 0);

// IST has a fixed +05:30 offset and no DST, so every expected instant below is
// the UTC epoch of the intended IST wall-clock time.

test("timed task today resolves to that IST wall-clock instant", () => {
  // today (offset 0) at 17:00 IST == 2026-06-22 11:30 UTC
  assert.equal(computeRemindAt(0, "17:00", NOW), Date.UTC(2026, 5, 22, 11, 30));
});

test("timed task tomorrow adds a day", () => {
  // offset 1 at 17:00 IST == 2026-06-23 11:30 UTC
  assert.equal(computeRemindAt(1, "17:00", NOW), Date.UTC(2026, 5, 23, 11, 30));
});

test("date-only task defaults to 09:00 IST", () => {
  // offset 0, no time -> 2026-06-22 09:00 IST == 2026-06-22 03:30 UTC
  assert.equal(computeRemindAt(0, null, NOW), Date.UTC(2026, 5, 22, 3, 30));
});

test("no-date task returns null", () => {
  assert.equal(computeRemindAt(null, "17:00", NOW), null);
  assert.equal(computeRemindAt(undefined, null, NOW), null);
});

test("someday returns null", () => {
  assert.equal(computeRemindAt("someday", null, NOW), null);
});

test("negative offset (overdue) resolves to a past IST instant", () => {
  // offset -1 at 08:00 IST == 2026-06-21 08:00 IST == 2026-06-21 02:30 UTC
  assert.equal(computeRemindAt(-1, "08:00", NOW), Date.UTC(2026, 5, 21, 2, 30));
});

test("the day boundary is IST, not UTC", () => {
  // 2026-06-22 19:00 UTC is already 2026-06-23 00:30 IST, so 'today' is the 23rd.
  const lateUtc = Date.UTC(2026, 5, 22, 19, 0, 0);
  // offset 0 at 09:00 IST -> 2026-06-23 09:00 IST == 2026-06-23 03:30 UTC
  assert.equal(computeRemindAt(0, "09:00", lateUtc), Date.UTC(2026, 5, 23, 3, 30));
});
