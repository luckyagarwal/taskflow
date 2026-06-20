// e2e/storage.spec.js — Local-first storage guarantees.
//
// Validates the headline properties of the offline-first rework:
//   1. Edits survive a failed/offline save and a page reload (outbox durability).
//   2. A change on one tab propagates live to another via the SSE/BroadcastChannel
//      "tickle" → incremental pull, and the pull is incremental (?since=), not a
//      full reload.

import { test, expect } from "@playwright/test";
import {
  createMockDb,
  seedMockDb,
  setupApiMocks,
  waitForAppLoad,
  addTaskViaComposer,
  taskByTitle,
} from "./helpers.js";

test.describe("Local-first storage", () => {
  let mockDb;

  test.beforeEach(() => {
    mockDb = seedMockDb(createMockDb());
  });

  test("edit survives a failed save and a reload, then drains when back online", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setupApiMocks(page, mockDb);

    // Saves fail while "offline". Registered AFTER setupApiMocks so this handler
    // runs first; when back online it falls through to the normal mock save.
    let saveOnline = false;
    await page.route("**/api/save", async (route) => {
      if (!saveOnline) return route.abort();
      return route.fallback();
    });

    await page.goto("/");
    await waitForAppLoad(page);

    // Create a task while saves are failing.
    await addTaskViaComposer(page, "Survives offline");
    await expect(taskByTitle(page, "Survives offline")).toBeVisible({ timeout: 5000 });
    expect(mockDb.tasks.some((t) => t.title === "Survives offline")).toBe(false);

    // Reload — the edit is replayed from the local store, not lost.
    await page.reload();
    await waitForAppLoad(page);
    await expect(taskByTitle(page, "Survives offline")).toBeVisible({ timeout: 5000 });

    // Come back online and let the outbox drain.
    saveOnline = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => mockDb.tasks.some((t) => t.title === "Survives offline"), {
      timeout: 8000,
    }).toBe(true);

    await context.close();
  });

  test("a change on one tab appears live on another (incremental pull)", async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    await setupApiMocks(tab1, mockDb);
    await setupApiMocks(tab2, mockDb);

    // Record the data pulls tab2 makes so we can assert they're incremental.
    const tab2DataUrls = [];
    tab2.on("request", (req) => {
      if (req.url().includes("/api/data")) tab2DataUrls.push(req.url());
    });

    await tab1.goto("http://localhost:5173/");
    await tab2.goto("http://localhost:5173/");
    await waitForAppLoad(tab1);
    await waitForAppLoad(tab2);

    // Create on tab1 — saveChanges() broadcasts api-changed; tab2 pulls and renders.
    await addTaskViaComposer(tab1, "Live across tabs");
    await expect(taskByTitle(tab2, "Live across tabs")).toBeVisible({ timeout: 8000 });

    // At least one of tab2's pulls used an incremental watermark (?since=<n>),
    // i.e. it did NOT re-download everything.
    const incremental = tab2DataUrls.some((u) => {
      const m = u.match(/[?&]since=(\d+)/);
      return m && Number(m[1]) > 0;
    });
    expect(incremental).toBe(true);

    await context.close();
  });
});
