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

    // Should show Browse header
    await expect(page.getByText("Browse").first()).toBeVisible();

    // Should show bottom tab bar labels
    await expect(
      page.getByText("Browse", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Calendar", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Search", { exact: true }).first()
    ).toBeVisible();
  });

  test("mobile shows browse view on initial load", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Initial load: Browse view shows grid cards
    await expect(
      page.getByText("Inbox", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Upcoming", { exact: true }).first()
    ).toBeVisible();
  });

  test("bottom tab navigation works", async ({ page }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Tap Upcoming card on the Browse view
    await page.getByText("Upcoming", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Should show upcoming task
    await expect(taskByTitle(page, "Review PR")).toBeVisible();

    // Tap the Browse back button to return to Browse view
    await page.getByText("Browse", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Browse view shows grid cards
    await expect(
      page.getByText("Inbox", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Upcoming", { exact: true }).first()
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

    // Tap on Today card to see today's tasks
    await page.getByText("Today", { exact: true }).first().click();
    await page.waitForTimeout(500);

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

    // Tap on Today card to see today's tasks
    await page.getByText("Today", { exact: true }).first().click();
    await page.waitForTimeout(500);

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

  test("today navigation from Browse shows back button and returns to Browse", async ({
    page,
  }) => {
    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Tap on Today card
    await page.getByText("Today", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Should show Today view header
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

    // Tap the Browse back button to return to Browse view
    await page.getByText("Browse", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Browse view shows grid cards (Inbox, Upcoming, etc.)
    await expect(
      page.getByText("Inbox", { exact: true }).first()
    ).toBeVisible();
  });

  test("opening search overlay should not scroll the background view to the top", async ({ page }) => {
    // Seed 20 additional tasks for today to make sure it is scrollable
    for (let i = 1; i <= 20; i++) {
      mockDb.tasks.push({
        id: `task_extra_${i}`,
        title: `Extra Task ${i}`,
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
        createdAt: Date.now() - 100000 + i * 1000,
        updatedAt: Date.now(),
        subtaskSort: "manual",
        position: i,
        status: "planned",
      });
    }

    await page.goto("/mobile");
    await waitForAppLoad(page);

    // Navigate to Today view first (it has tasks and is scrollable)
    await page.getByText("Today", { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Locate the main scroll container
    const scrollContainer = page.locator("div.scroll").first();

    const heightsBefore = await scrollContainer.evaluate(el => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    }));
    console.log("Container heights before scroll:", heightsBefore);

    // Scroll the container down by 200px
    await scrollContainer.evaluate(el => el.scrollTop = 200);
    await page.waitForTimeout(200);

    // Scroll up slightly to make the tab bar visible again (mimics real user behavior)
    await scrollContainer.evaluate(el => el.scrollTop = 180);
    await page.waitForTimeout(200);

    // Check that it actually scrolled
    const scrollTopBefore = await scrollContainer.evaluate(el => el.scrollTop);
    console.log("Scroll position before tapping search:", scrollTopBefore);
    expect(scrollTopBefore).toBeGreaterThan(50);

    // Tap the Search tab at the bottom to open search
    await page.getByText("Search", { exact: true }).last().click();
    await page.waitForTimeout(500);

    // Verify search input is visible
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();

    const parentScrollTop = await page.evaluate(() => {
      const parent = document.querySelector('div[style*="position: relative; height: 100%"]');
      return parent ? parent.scrollTop : null;
    });
    console.log("MobileApp container scrollTop:", parentScrollTop);
    expect(parentScrollTop).toBe(0);

    // Take screenshot of search overlay
    await page.screenshot({ path: "/Users/casex/.gemini/antigravity/brain/251a2be0-93d0-4b9d-8785-67778551a7c0/scratch/search_overlay.png" });

    const bodyScrollTop = await page.evaluate(() => ({
      bodyScrollTop: document.body.scrollTop,
      htmlScrollTop: document.documentElement.scrollTop,
      windowScrollY: window.scrollY
    }));
    console.log("Window/Body scroll position:", bodyScrollTop);

    // Check the scroll position of the background scroll container
    const scrollTopAfter = await scrollContainer.evaluate(el => el.scrollTop);
    console.log("Scroll position after tapping search:", scrollTopAfter);

    // The scroll position should NOT have been reset to 0
    expect(scrollTopAfter).toBe(scrollTopBefore);
  });
});
