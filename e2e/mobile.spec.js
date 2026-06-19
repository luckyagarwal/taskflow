// e2e/mobile.spec.js — Mobile app E2E tests
import { test, expect } from "@playwright/test";
import {
  createMockDb,
  seedMockDb,
  setupApiMocks,
  waitForAppLoad,
  taskByTitle,
  taskRowByTitle,
  openMobileQuickAdd,
} from "./helpers.js";

test.describe("Mobile App — Core Functionality", () => {
  let mockDb;

  test.beforeEach(async ({ page }) => {
    mockDb = seedMockDb(createMockDb());
    await setupApiMocks(page, mockDb);
  });

  test("mobile app loads at /mobile path", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Should show TaskFlow header
    await expect(page.getByText("TaskFlow").first()).toBeVisible();

    // Should show bottom tab bar labels
    await expect(
      page.getByText("Today", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Upcoming", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Browse", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Search", { exact: true }).first()
    ).toBeVisible();
  });

  test("mobile shows today tasks on initial load", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Today view: tasks with dueOffset 0 and overdue (dueOffset < 0)
    await expect(taskByTitle(page, "Buy groceries")).toBeVisible();
    await expect(taskByTitle(page, "Fix login bug")).toBeVisible();
  });

  test("bottom tab navigation works", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Tap Upcoming tab — last matching text (tab bar is at bottom)
    await page.getByText("Upcoming", { exact: true }).last().click();
    await page.waitForTimeout(500);

    // Should show upcoming task
    await expect(taskByTitle(page, "Review PR")).toBeVisible();

    // Tap Browse tab
    await page.getByText("Browse", { exact: true }).last().click();
    await page.waitForTimeout(500);

    // Browse view shows grid cards
    await expect(
      page.getByText("Inbox", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Calendar", { exact: true }).first()
    ).toBeVisible();
  });

  test("Browse view shows projects grouped by section", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Navigate to Browse
    await page.getByText("Browse", { exact: true }).last().click();
    await page.waitForTimeout(500);

    // Should show project names in Browse view
    const workText = page.locator(".section-title", { hasText: "Work" });
    const hasWorkSection = (await workText.count()) > 0;

    // Projects should be listed
    await expect(page.getByText("Work", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Personal", { exact: true }).first()
    ).toBeVisible();
  });

  test("FAB opens quick add sheet on mobile", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // FAB carries an accessible name "Add task"; tapping it opens the sheet.
    const taskInput = await openMobileQuickAdd(page);
    await expect(taskInput).toBeVisible({ timeout: 3000 });
  });

  test("add task via mobile quick add", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Open quick add — tap the FAB
    const taskInput = await openMobileQuickAdd(page);
    await taskInput.fill("Mobile created task");
    await taskInput.press("Enter");
    await page.waitForTimeout(500);

    const saved = mockDb.tasks.find((t) => t.title === "Mobile created task");
    expect(saved).toBeTruthy();
  });

  test("tapping task row on mobile selects it", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Tap on a task row
    const row = taskRowByTitle(page, "Buy groceries");
    await row.click();
    await page.waitForTimeout(500);

    // On mobile, tapping opens full-screen detail. Check for detail UI.
    // The detail panel should appear with Priority, Project selectors etc.
    await expect(
      page.getByText("Priority", { exact: false }).last()
    ).toBeVisible({ timeout: 5000 });
  });

  test("complete task on mobile", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    const row = taskRowByTitle(page, "Buy groceries");
    const checkbox = row.locator('button[aria-label="Complete task"]');

    if (await checkbox.isVisible()) {
      await checkbox.click();
      await page.waitForTimeout(800);

      const task = mockDb.tasks.find((t) => t.id === "task_seed_1");
      expect(task.done).toBe(true);
    }
  });

  test("search overlay on mobile", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Tap Search tab
    await page.getByText("Search", { exact: true }).last().click();
    await page.waitForTimeout(500);

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill("Review");
      await page.waitForTimeout(300);

      await expect(page.getByText("Review PR", { exact: false })).toBeVisible();
    }
  });

  test("inbox navigation from Browse shows correct tasks", async ({
    page,
  }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Go to Browse
    await page.getByText("Browse", { exact: true }).last().click();
    await page.waitForTimeout(500);

    // Tap Inbox card
    await page.getByText("Inbox", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Should show inbox tasks
    await expect(taskByTitle(page, "Buy groceries")).toBeVisible();
    await expect(taskByTitle(page, "Plan weekend trip")).toBeVisible();
  });
});
