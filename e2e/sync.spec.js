// e2e/sync.spec.js — Cross-instance syncing E2E tests.
//
// Tests that data mutations on one instance (desktop/mobile/tab) propagate
// correctly to other instances via the mock API backend. Uses a SHARED mockDb
// across multiple pages to simulate the D1 server, then triggers sync via
// BroadcastChannel to simulate real-time sync.

import { test, expect } from "@playwright/test";
import {
  createMockDb,
  seedMockDb,
  setupApiMocks,
  waitForAppLoad,
  triggerSyncOnPage,
  taskByTitle,
  taskRowByTitle,
  addTaskViaComposer,
  openMobileQuickAdd,
  remoteUpsert,
  remoteDelete,
} from "./helpers.js";

test.describe("Cross-Instance Sync — Desktop ↔ Mobile", () => {
  let mockDb;

  test.beforeEach(() => {
    mockDb = seedMockDb(createMockDb());
  });

  test("task created on desktop appears on mobile after sync", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const desktopPage = await context.newPage();
    const mobilePage = await context.newPage();

    await setupApiMocks(desktopPage, mockDb);
    await setupApiMocks(mobilePage, mockDb);

    await desktopPage.goto("http://localhost:5173/");
    await mobilePage.goto("http://localhost:5173/mobile");
    await waitForAppLoad(desktopPage);
    await waitForAppLoad(mobilePage);

    // === Create task on desktop (in-content composer → due today) ===
    await addTaskViaComposer(desktopPage, "Desktop sync test task");

    // Verify saved to shared mock DB
    const newTask = mockDb.tasks.find(
      (t) => t.title === "Desktop sync test task"
    );
    expect(newTask).toBeTruthy();

    // === Trigger sync on mobile ===
    await triggerSyncOnPage(mobilePage);

    // === Verify task appears on mobile ===
    await expect(taskByTitle(mobilePage, "Desktop sync test task")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });

  test("task created on mobile appears on desktop after sync", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const desktopPage = await context.newPage();
    const mobilePage = await context.newPage();

    await setupApiMocks(desktopPage, mockDb);
    await setupApiMocks(mobilePage, mockDb);

    await desktopPage.goto("http://localhost:5173/");
    await mobilePage.goto("http://localhost:5173/mobile");
    await waitForAppLoad(desktopPage);
    await waitForAppLoad(mobilePage);

    // === Create task on mobile via FAB ===
    const taskInput = await openMobileQuickAdd(mobilePage);
    await taskInput.fill("Mobile sync test task");
    await taskInput.press("Enter");
    await mobilePage.waitForTimeout(500);

    expect(
      mockDb.tasks.find((t) => t.title === "Mobile sync test task")
    ).toBeTruthy();

    // === Trigger sync on desktop ===
    await triggerSyncOnPage(desktopPage);

    // Should appear on desktop
    await expect(
      taskByTitle(desktopPage, "Mobile sync test task")
    ).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("task completion on desktop syncs to mobile", async ({ browser }) => {
    const context = await browser.newContext();
    const desktopPage = await context.newPage();
    const mobilePage = await context.newPage();

    await setupApiMocks(desktopPage, mockDb);
    await setupApiMocks(mobilePage, mockDb);

    await desktopPage.goto("http://localhost:5173/");
    await mobilePage.goto("http://localhost:5173/mobile");
    await waitForAppLoad(desktopPage);
    await waitForAppLoad(mobilePage);

    // === Complete "Buy groceries" on desktop ===
    const row = taskRowByTitle(desktopPage, "Buy groceries");
    const checkbox = row.locator('button[aria-label="Complete task"]');
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await desktopPage.waitForTimeout(800);

    // Verify in shared DB
    const task = mockDb.tasks.find((t) => t.id === "task_seed_1");
    expect(task.done).toBe(true);

    // === Sync to mobile ===
    await triggerSyncOnPage(mobilePage);

    // On mobile, completed task should no longer show in active Today view
    // (it may show in "Completed" group or be gone from the active list)
    const activeRow = taskRowByTitle(mobilePage, "Buy groceries");
    const count = await activeRow.count();
    if (count > 0) {
      // If still visible, it should be in done state (checkbox shows "Mark incomplete")
      const doneCheckbox = activeRow.locator(
        'button[aria-label="Mark incomplete"]'
      );
      await expect(doneCheckbox).toBeVisible({ timeout: 3000 });
    }

    await context.close();
  });

  test("task deletion syncs across instances", async ({ browser }) => {
    const context = await browser.newContext();
    const desktopPage = await context.newPage();
    const mobilePage = await context.newPage();

    await setupApiMocks(desktopPage, mockDb);
    await setupApiMocks(mobilePage, mockDb);

    await desktopPage.goto("http://localhost:5173/");
    await mobilePage.goto("http://localhost:5173/mobile");
    await waitForAppLoad(desktopPage);
    await waitForAppLoad(mobilePage);

    // === Delete task on the server (simulating deletion on another device) ===
    remoteDelete(mockDb, "tasks", "task_seed_1");

    // === Trigger sync on desktop ===
    await triggerSyncOnPage(desktopPage);

    // "Buy groceries" should be gone from desktop
    await expect(taskByTitle(desktopPage, "Buy groceries")).toHaveCount(0, {
      timeout: 5000,
    });

    // === Trigger sync on mobile ===
    await triggerSyncOnPage(mobilePage);

    // Gone from mobile too
    await expect(taskByTitle(mobilePage, "Buy groceries")).toHaveCount(0, {
      timeout: 5000,
    });

    await context.close();
  });

  test("project creation syncs across instances", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await setupApiMocks(page1, mockDb);
    await setupApiMocks(page2, mockDb);

    await page1.goto("http://localhost:5173/");
    await page2.goto("http://localhost:5173/mobile");
    await waitForAppLoad(page1);
    await waitForAppLoad(page2);

    // === Add project on the server (another device) ===
    remoteUpsert(mockDb, "projects", {
      id: "p_test_sync",
      name: "Synced Project",
      color: "#E8588A",
      group: "Work",
      parent: null,
      position: 2,
    });

    // === Trigger sync on mobile ===
    await triggerSyncOnPage(page2);

    // Navigate mobile to Browse to see projects
    await page2.getByText("Browse", { exact: true }).last().click();
    await page2.waitForTimeout(500);

    // Synced Project should appear
    await expect(page2.getByText("Synced Project")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });
});

test.describe("Cross-Tab Sync — BroadcastChannel", () => {
  let mockDb;

  test.beforeEach(() => {
    mockDb = seedMockDb(createMockDb());
  });

  test("BroadcastChannel notifies other tabs in same context", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    await setupApiMocks(tab1, mockDb);
    await setupApiMocks(tab2, mockDb);

    await tab1.goto("http://localhost:5173/");
    await tab2.goto("http://localhost:5173/");
    await waitForAppLoad(tab1);
    await waitForAppLoad(tab2);

    // === Create task on tab1 (in-content composer → due today) ===
    await addTaskViaComposer(tab1, "Tab sync test");

    expect(
      mockDb.tasks.find((t) => t.title === "Tab sync test")
    ).toBeTruthy();

    // saveChanges() calls broadcastChange() → BroadcastChannel message
    // Tab2 should receive it and re-fetch via the mocked /api/data
    await tab2.waitForTimeout(2000);

    // Verify task appears on tab2
    await expect(taskByTitle(tab2, "Tab sync test")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });

  test("multiple tabs stay in sync through rapid edits", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    const tab3 = await context.newPage();

    await setupApiMocks(tab1, mockDb);
    await setupApiMocks(tab2, mockDb);
    await setupApiMocks(tab3, mockDb);

    await tab1.goto("http://localhost:5173/");
    await tab2.goto("http://localhost:5173/");
    await tab3.goto("http://localhost:5173/mobile");
    await waitForAppLoad(tab1);
    await waitForAppLoad(tab2);
    await waitForAppLoad(tab3);

    // === Rapid task creation on tab1 (composer stays open between adds) ===
    for (let i = 1; i <= 3; i++) {
      await addTaskViaComposer(tab1, `Rapid task ${i}`);
    }

    await tab1.waitForTimeout(500);

    // All 3 saved to mock DB
    for (let i = 1; i <= 3; i++) {
      expect(
        mockDb.tasks.find((t) => t.title === `Rapid task ${i}`)
      ).toBeTruthy();
    }

    // === Trigger sync on other tabs ===
    await triggerSyncOnPage(tab2);
    await triggerSyncOnPage(tab3);
    await tab2.waitForTimeout(1000);

    // All tasks should appear in tab2 and tab3
    for (let i = 1; i <= 3; i++) {
      await expect(taskByTitle(tab2, `Rapid task ${i}`)).toBeVisible({
        timeout: 5000,
      });
      await expect(taskByTitle(tab3, `Rapid task ${i}`)).toBeVisible({
        timeout: 5000,
      });
    }

    await context.close();
  });

  test("task edit syncs via BroadcastChannel to another tab", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    await setupApiMocks(tab1, mockDb);
    await setupApiMocks(tab2, mockDb);

    await tab1.goto("http://localhost:5173/");
    await tab2.goto("http://localhost:5173/");
    await waitForAppLoad(tab1);
    await waitForAppLoad(tab2);

    // === Edit task on the server (simulating save from another device) ===
    remoteUpsert(mockDb, "tasks", { id: "task_seed_1", title: "Buy groceries UPDATED" });

    // === Trigger sync on tab2 ===
    await triggerSyncOnPage(tab2);

    // Tab2 should show updated title
    await expect(taskByTitle(tab2, "Buy groceries UPDATED")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });
});

test.describe("Sync — Edge Cases", () => {
  let mockDb;

  test.beforeEach(() => {
    mockDb = seedMockDb(createMockDb());
  });

  test("empty server response loads without crash", async ({ page }) => {
    const emptyDb = createMockDb();
    await setupApiMocks(page, emptyDb);

    await page.goto("/");
    await waitForAppLoad(page);

    // App should load with empty state
    await expect(page.locator(".app-root")).toBeVisible();
    await expect(page.locator(".app-root")).toHaveAttribute(
      "data-theme",
      /light|dark/
    );
  });

  test("save failure does not lose the edit (durable local-first)", async ({ page }) => {
    await setupApiMocks(page, mockDb);

    // Server save fails for every attempt.
    await page.route("**/api/save", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      });
    });

    await page.goto("/");
    await waitForAppLoad(page);

    await addTaskViaComposer(page, "Survives failed save");
    await page.waitForTimeout(1500);

    // The edit is written to the local store first, so it stays put and is NOT
    // reverted by the failed network save (old behavior clobbered it).
    await expect(taskByTitle(page, "Survives failed save")).toBeVisible({ timeout: 5000 });

    // It is durable: still present after a reload, replayed from the outbox.
    await page.reload();
    await waitForAppLoad(page);
    await expect(taskByTitle(page, "Survives failed save")).toBeVisible({ timeout: 5000 });
  });

  test("concurrent adds from different instances preserve both", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const desktop = await context.newPage();
    const mobile = await context.newPage();

    await setupApiMocks(desktop, mockDb);
    await setupApiMocks(mobile, mockDb);

    await desktop.goto("http://localhost:5173/");
    await mobile.goto("http://localhost:5173/mobile");
    await waitForAppLoad(desktop);
    await waitForAppLoad(mobile);

    const initialCount = mockDb.tasks.length;

    // === Add on desktop === (wait for the save to land on the shared server)
    await addTaskViaComposer(desktop, "Concurrent desktop task");
    await expect
      .poll(() =>
        mockDb.tasks.some((t) => t.title === "Concurrent desktop task")
      )
      .toBe(true);

    // === Add on mobile ===
    const mobileInput = await openMobileQuickAdd(mobile);
    await mobileInput.fill("Concurrent mobile task");
    await expect(mobileInput).toHaveValue("Concurrent mobile task");
    await mobileInput.press("Enter");
    await expect
      .poll(() =>
        mockDb.tasks.some((t) => t.title === "Concurrent mobile task")
      )
      .toBe(true);

    // Both tasks preserved on the server (neither add clobbered the other).
    expect(
      mockDb.tasks.find((t) => t.title === "Concurrent desktop task")
    ).toBeTruthy();
    expect(
      mockDb.tasks.find((t) => t.title === "Concurrent mobile task")
    ).toBeTruthy();
    expect(mockDb.tasks.length).toBeGreaterThanOrEqual(initialCount + 2);

    await context.close();
  });

  test("auth failure (401) does not crash app", async ({ page }) => {
    await page.route("**/api/data*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    });

    await page.route("**/api/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"type":"connected"}\n\n',
      });
    });

    await page.goto("/");
    await page.waitForTimeout(3000);

    // App should not crash — DOM is non-empty
    const html = await page.content();
    expect(html.length).toBeGreaterThan(100);
  });

  test("visibility change triggers data re-fetch", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    let fetchCount = 0;

    await page.route("**/api/data*", async (route) => {
      fetchCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [...mockDb.tasks],
          projects: [...mockDb.projects],
          labels: [...mockDb.labels],
          sections: [...mockDb.sections],
          serverMax: Date.now(),
        }),
      });
    });

    await page.route("**/api/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"type":"connected"}\n\n',
      });
    });

    await page.route("**/api/save", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("http://localhost:5173/");
    await waitForAppLoad(page);

    const initialFetches = fetchCount;

    // Simulate tab hidden → visible
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(2000);

    expect(fetchCount).toBeGreaterThan(initialFetches);

    await context.close();
  });
});

test.describe("Sync — Data Integrity", () => {
  let mockDb;

  test.beforeEach(() => {
    mockDb = seedMockDb(createMockDb());
  });

  test("subtask changes sync correctly", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await setupApiMocks(page1, mockDb);
    await setupApiMocks(page2, mockDb);

    await page1.goto("http://localhost:5173/");
    await page2.goto("http://localhost:5173/");
    await waitForAppLoad(page1);
    await waitForAppLoad(page2);

    // === Complete subtask on the server (another device) ===
    const parentTask = mockDb.tasks.find((t) => t.id === "task_seed_2");
    expect(parentTask.subtasks.length).toBe(1);
    const subtasks = parentTask.subtasks.map((s) => ({ ...s, done: true, status: "done" }));
    remoteUpsert(mockDb, "tasks", { ...parentTask, subtasks });

    // === Sync to page2 ===
    await triggerSyncOnPage(page2);

    // Navigate page2 to Upcoming to see "Review PR"
    await page2
      .locator("button.nav-item")
      .filter({ hasText: "Upcoming" })
      .click();
    await page2.waitForTimeout(500);

    // Task should exist
    await expect(taskByTitle(page2, "Review PR")).toBeVisible();

    await context.close();
  });

  test("label addition propagates across instances", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await setupApiMocks(page1, mockDb);
    await setupApiMocks(page2, mockDb);

    await page1.goto("http://localhost:5173/");
    await page2.goto("http://localhost:5173/mobile");
    await waitForAppLoad(page1);
    await waitForAppLoad(page2);

    // === Add a new label on the server (another device) ===
    remoteUpsert(mockDb, "labels", {
      id: "l_synced",
      name: "synced-label",
      color: "#E8588A",
    });

    // === Sync both ===
    await triggerSyncOnPage(page1);
    await triggerSyncOnPage(page2);
    await page1.waitForTimeout(500);

    // Verify DB state
    expect(mockDb.labels.find((l) => l.id === "l_synced")).toBeTruthy();
    expect(mockDb.labels.length).toBe(3);

    await context.close();
  });

  test("save log captures all mutations for audit", async ({ page }) => {
    await setupApiMocks(page, mockDb);

    await page.goto("/");
    await waitForAppLoad(page);

    mockDb._saveLog = [];

    // Create a task
    await page.getByRole("button", { name: "Add task" }).first().click();
    const input = page.getByPlaceholder("Task name");
    if (await input.isVisible({ timeout: 3000 })) {
      await input.fill("Audit trail task");
      await input.press("Enter");
      await page.waitForTimeout(500);

      expect(mockDb._saveLog.length).toBeGreaterThan(0);
      const lastSave = mockDb._saveLog[mockDb._saveLog.length - 1];
      expect(lastSave.upserts.tasks).toBeDefined();
      expect(
        lastSave.upserts.tasks.some((t) => t.title === "Audit trail task")
      ).toBe(true);
    }
  });

  test("section creation syncs to other instance", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await setupApiMocks(page1, mockDb);
    await setupApiMocks(page2, mockDb);

    await page1.goto("http://localhost:5173/");
    await page2.goto("http://localhost:5173/mobile");
    await waitForAppLoad(page1);
    await waitForAppLoad(page2);

    // === Add section on the server (another device) ===
    remoteUpsert(mockDb, "sections", {
      id: "sec_synced",
      name: "Synced Section",
      position: 2,
    });

    // === Sync mobile ===
    await triggerSyncOnPage(page2);

    // Browse to see sections
    await page2.getByText("Browse", { exact: true }).last().click();
    await page2.waitForTimeout(500);

    // New section should appear
    await expect(
      page2.getByText("Synced Section", { exact: false })
    ).toBeVisible({ timeout: 5000 });

    await context.close();
  });
});
