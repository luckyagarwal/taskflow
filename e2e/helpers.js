// e2e/helpers.js — Shared mock API infrastructure for E2E tests.
// Creates a mock in-memory "D1 database" that multiple pages can share
// through intercepted route handlers, enabling true sync testing.

import { expect } from "@playwright/test";

/**
 * Creates a mock database instance that simulates the D1 backend.
 * All pages sharing this mockDb see the same data — like a real server.
 */
export function createMockDb() {
  const db = {
    tasks: [],
    projects: [],
    labels: [],
    sections: [],
    _updateCounter: 0,
    _saveLog: [], // records every save call for assertions
  };

  return db;
}

/**
 * Seeds the mock database with sample data for testing.
 */
export function seedMockDb(db) {
  db.tasks = [
    {
      id: "task_seed_1",
      title: "Buy groceries",
      note: "",
      projectId: "inbox",
      startOffset: null,
      dueOffset: 0,
      time: null,
      priority: 4,
      labels: [],
      subtasks: [],
      done: false,
      doneOffset: null,
      recurring: null,
      createdAt: Date.now() - 100000,
      subtaskSort: "manual",
      position: 0,
      status: "planned",
    },
    {
      id: "task_seed_2",
      title: "Review PR",
      note: "Check the auth module changes",
      projectId: "p_work",
      startOffset: null,
      dueOffset: 1,
      time: "10:00",
      priority: 2,
      labels: ["l_deep"],
      subtasks: [
        {
          id: "s_sub1",
          title: "Check tests",
          done: false,
          priority: 4,
          status: "planned",
          startOffset: null,
          dueOffset: null,
          createdAt: Date.now() - 50000,
        },
      ],
      done: false,
      doneOffset: null,
      recurring: null,
      createdAt: Date.now() - 200000,
      subtaskSort: "manual",
      position: 1,
      status: "planned",
    },
    {
      id: "task_seed_3",
      title: "Morning run",
      note: "",
      projectId: "p_personal",
      startOffset: null,
      dueOffset: 0,
      time: "07:00",
      priority: 3,
      labels: [],
      subtasks: [],
      done: true,
      doneOffset: 0,
      recurring: null,
      createdAt: Date.now() - 300000,
      subtaskSort: "manual",
      position: 2,
      status: "done",
    },
    {
      id: "task_seed_4",
      title: "Plan weekend trip",
      note: "",
      projectId: "inbox",
      startOffset: null,
      dueOffset: null,
      time: null,
      priority: 4,
      labels: [],
      subtasks: [],
      done: false,
      doneOffset: null,
      recurring: null,
      createdAt: Date.now() - 400000,
      subtaskSort: "manual",
      position: 3,
      status: "planned",
    },
    {
      id: "task_seed_5",
      title: "Fix login bug",
      note: "Regression from v2.1",
      projectId: "p_work",
      startOffset: null,
      dueOffset: -1,
      time: null,
      priority: 1,
      labels: ["l_deep"],
      subtasks: [],
      done: false,
      doneOffset: null,
      recurring: null,
      createdAt: Date.now() - 500000,
      subtaskSort: "manual",
      position: 4,
      status: "inprogress",
    },
  ];

  db.projects = [
    {
      id: "p_work",
      name: "Work",
      color: "#2D7FF9",
      group: "Work",
      parent: null,
      position: 0,
    },
    {
      id: "p_personal",
      name: "Personal",
      color: "#1F9D55",
      group: "Personal",
      parent: null,
      position: 1,
    },
  ];

  db.labels = [
    { id: "l_deep", name: "deep work", color: "#7C5CFC" },
    { id: "l_quick", name: "quick win", color: "#1F9D55" },
  ];

  db.sections = [
    { id: "sec_work", name: "Work", position: 0 },
    { id: "sec_personal", name: "Personal", position: 1 },
  ];

  return db;
}

/**
 * Wires up API route mocks on a Playwright page, backed by shared mockDb.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} mockDb  — shared mutable state from createMockDb()
 * @param {object} opts    — { onSave?: function } callback when save happens
 */
export async function setupApiMocks(page, mockDb, opts = {}) {
  // GET /api/data — returns current DB state
  await page.route("**/api/data", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tasks: [...mockDb.tasks],
        projects: [...mockDb.projects],
        labels: [...mockDb.labels],
        sections: [...mockDb.sections],
      }),
    });
  });

  // POST /api/save — upserts and deletes, mutates shared mockDb
  await page.route("**/api/save", async (route, request) => {
    if (request.method() === "DELETE") {
      // Wipe all data
      mockDb.tasks = [];
      mockDb.projects = [];
      mockDb.labels = [];
      mockDb.sections = [];
      mockDb._updateCounter++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, wipedAt: Date.now() }),
      });
      return;
    }

    try {
      const body = JSON.parse(request.postData() || "{}");
      const { upserts = {}, deletes = {} } = body;

      // Record save for assertions
      mockDb._saveLog.push({ upserts, deletes, at: Date.now() });

      // Apply upserts
      for (const table of ["tasks", "projects", "labels", "sections"]) {
        const upList = upserts[table] || [];
        for (const item of upList) {
          if (!item || !item.id) continue;
          const idx = mockDb[table].findIndex((x) => x.id === item.id);
          if (idx >= 0) {
            mockDb[table][idx] = { ...mockDb[table][idx], ...item };
          } else {
            mockDb[table].push(item);
          }
        }

        const delList = deletes[table] || [];
        for (const id of delList) {
          mockDb[table] = mockDb[table].filter((x) => x.id !== id);
        }
      }

      mockDb._updateCounter++;
      if (opts.onSave) opts.onSave(body);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, timestamp: Date.now() }),
      });
    } catch (err) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid JSON body" }),
      });
    }
  });

  // GET /api/events — SSE stub (just send connected, no polling)
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"type":"connected"}\n\n',
    });
  });
}

/**
 * Waits for the app to finish loading (spinner goes away, tasks appear).
 */
export async function waitForAppLoad(page) {
  // Wait for the pulse-loader to disappear
  await page.waitForFunction(
    () => {
      const loader = document.querySelector(".pulse-loader");
      return !loader;
    },
    { timeout: 15000 }
  );
  // Give React a tick to finish rendering
  await page.waitForTimeout(500);
}

/**
 * Triggers a "sync reload" on a page by making it re-fetch /api/data.
 * Simulates what happens when BroadcastChannel or SSE fires api-changed.
 */
export async function triggerSyncOnPage(page) {
  await page.evaluate(() => {
    // Dispatch a BroadcastChannel message to trigger reload
    const ch = new BroadcastChannel("taskflow-api-channel");
    ch.postMessage({ type: "api-changed" });
    ch.close();
  });
  // Wait for the fetch & re-render cycle
  await page.waitForTimeout(1500);
}

/**
 * Adds a task on the DESKTOP app via the in-content inline composer.
 *
 * The sidebar "Add task" opens the centered QuickAddModal which defaults to
 * Inbox / no due date — tasks created there don't appear in the Today view.
 * The in-content composer is the LAST "Add task" button and inherits the
 * current view's defaults (e.g. due=today on the Today view), and stays open
 * after Enter (Todoist-style "add another"), so repeated adds just refill it.
 */
export async function addTaskViaComposer(page, title) {
  const input = page.getByPlaceholder("Task name");
  if (!(await input.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Add task" }).last().click();
  }
  const field = page.getByPlaceholder("Task name");
  await field.waitFor({ state: "visible", timeout: 5000 });
  await field.fill(title);
  // Ensure React has committed the controlled value before Enter submits,
  // otherwise submit() can read a stale (empty) title and no-op.
  await expect(field).toHaveValue(title);
  await field.press("Enter");
  await page.waitForTimeout(400);
}

/**
 * Opens the MOBILE quick-add sheet via the FAB (accessible name "Add task")
 * and returns the task-name input locator.
 */
export async function openMobileQuickAdd(page) {
  // The mobile Today view also renders an inline "Add task" composer button, so
  // the FAB (aria-label "Add task") is the LAST such button in the DOM.
  await page.getByRole("button", { name: "Add task" }).last().click();
  const input = page.getByPlaceholder("Task name");
  await input.waitFor({ state: "visible", timeout: 5000 });
  return input;
}

/**
 * Locator for a task row by its title text. TaskFlow uses <textarea>
 * for task titles inside `.task-row` divs with `data-task-id`.
 */
export function taskByTitle(page, title) {
  return page.locator(`.task-row textarea`).filter({ hasText: title });
}

/**
 * Locator for the task row container by title.
 */
export function taskRowByTitle(page, title) {
  return page.locator(`[data-task-id]`).filter({
    has: page.locator(`textarea`).filter({ hasText: title }),
  });
}
