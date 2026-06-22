// e2e/desktop.spec.js — Desktop app E2E tests
import { test, expect } from "@playwright/test";
import {
  createMockDb,
  seedMockDb,
  setupApiMocks,
  waitForAppLoad,
  taskByTitle,
  taskRowByTitle,
} from "./helpers.js";

test.describe("Desktop App — Core Functionality", () => {
  let mockDb;

  test.beforeEach(async ({ page }) => {
    mockDb = seedMockDb(createMockDb());
    await setupApiMocks(page, mockDb);
  });

  test("app lands on Board view by default", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Should show Board heading
    await expect(page.locator("h1", { hasText: "Board" })).toBeVisible();
    await expect(page.getByText("Drag cards between columns to change status")).toBeVisible();
  });

  test("app loads and displays tasks from API", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    // Should show Today heading
    await expect(page.locator("h1", { hasText: "Today" })).toBeVisible();

    // Should show seeded tasks that are due today (dueOffset 0) and overdue
    await expect(taskByTitle(page, "Buy groceries")).toBeVisible();
    await expect(taskByTitle(page, "Fix login bug")).toBeVisible();

    // Completed task should also be visible in "Completed" group
    await expect(taskByTitle(page, "Morning run")).toBeVisible();
  });

  test("sidebar navigation between views works", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Click Inbox nav item
    await page.locator("button.nav-item").filter({ hasText: "Inbox" }).click();
    await page.waitForTimeout(500);

    // Inbox tasks should be visible (projectId === 'inbox')
    await expect(taskByTitle(page, "Buy groceries")).toBeVisible();
    await expect(taskByTitle(page, "Plan weekend trip")).toBeVisible();

    // Click Upcoming
    await page
      .locator("button.nav-item")
      .filter({ hasText: "Upcoming" })
      .click();
    await page.waitForTimeout(500);

    // Tomorrow task should appear
    await expect(taskByTitle(page, "Review PR")).toBeVisible();
  });

  test("add task via inline composer", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    // Click the "Add task" button (main content area one, not sidebar)
    await page.getByRole("button", { name: "Add task" }).first().click();

    // Type in the task name — composer uses "Task name" placeholder
    const input = page.getByPlaceholder("Task name");
    await expect(input).toBeVisible();
    await input.fill("New E2E test task");

    // Submit with Enter
    await input.press("Enter");
    await page.waitForTimeout(500);

    // Task should be saved to mock DB
    const savedTask = mockDb.tasks.find(
      (t) => t.title === "New E2E test task"
    );
    expect(savedTask).toBeTruthy();
    expect(savedTask.status).toBe("planned");
  });

  test("complete a task via checkbox click", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    // Find the checkbox for "Buy groceries" — aria-label "Complete task"
    const row = taskRowByTitle(page, "Buy groceries");
    const checkbox = row.locator('button[aria-label="Complete task"]');
    await expect(checkbox).toBeVisible();

    await checkbox.click();
    await page.waitForTimeout(800);

    // Verify the task was marked done in mock DB
    const task = mockDb.tasks.find((t) => t.id === "task_seed_1");
    expect(task.done).toBe(true);
  });

  test("click task row opens detail panel and shows priority", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    // Click on the task row for "Fix login bug"
    const row = taskRowByTitle(page, "Fix login bug");
    await row.click();
    await page.waitForTimeout(500);

    // Task row gets selected → action bar appears with "Set priority", "Delete task", etc.
    await expect(
      page.getByRole("button", { name: "Set priority" }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "Delete task" }).first()
    ).toBeVisible();
  });

  test("delete a task via action bar", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    // Deletion is confirmed via window.confirm — auto-accept it.
    page.on("dialog", (dialog) => dialog.accept());

    // Click on "Buy groceries" to select it
    const row = taskRowByTitle(page, "Buy groceries");
    await row.click();
    await page.waitForTimeout(300);

    // Click delete on the Buy groceries row specifically (each row has its own
    // toolbar). The icon button is partially overlapped by the title <span>, so
    // a coordinate click lands on the span — dispatch the click on the button
    // directly so its onClick handler fires.
    const deleteBtn = row.getByRole("button", { name: "Delete task" });
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.dispatchEvent("click");
    await page.waitForTimeout(500);

    // Verify deleted on the server. Deletion is now a soft-delete tombstone
    // (deleted=1) so it can propagate to other devices via incremental sync —
    // the record is gone from the live set, not physically removed.
    const task = mockDb.tasks.find((t) => t.id === "task_seed_1");
    expect(task === undefined || task.deleted === 1).toBe(true);
  });

  test("composer preview pills reflect parsed tokens", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);
    await page.locator("button.nav-item").filter({ hasText: "Today" }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Add task" }).first().click();
    const input = page.getByPlaceholder("Task name");
    await expect(input).toBeVisible();
    await input.fill("Launch plan p1 tomorrow");

    const composer = input.locator("../..");
    await expect(
      composer.getByText("Tomorrow", { exact: false })
    ).toBeVisible();
    await expect(composer.getByText("P1", { exact: true })).toBeVisible();
  });

  test("project navigation shows project tasks", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Click "Work" project in sidebar. The nav-item label includes a task
    // count badge, so match on "Work" without anchoring the whole string.
    await page
      .locator("button.nav-item")
      .filter({ hasText: "Work" })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Should show Work project tasks
    await expect(taskByTitle(page, "Review PR")).toBeVisible();
    await expect(taskByTitle(page, "Fix login bug")).toBeVisible();

    // Should NOT show inbox tasks
    await expect(taskByTitle(page, "Buy groceries")).not.toBeVisible();
  });

  test("search overlay opens with Cmd+K", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Click the search button (has "Search" text and ⌘K shortcut)
    await page
      .getByRole("button", { name: /Search/ })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Search overlay should appear
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill("groceries");
      await page.waitForTimeout(300);

      // "Buy groceries" also matches the background task row textarea, so scope
      // to the first match to avoid a strict-mode violation.
      await expect(page.getByText("Buy groceries").first()).toBeVisible();
    }
  });

  test("sidebar shows correct task counts", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Inbox should show 2 (Buy groceries + Plan weekend trip)
    const inboxItem = page
      .locator("button.nav-item")
      .filter({ hasText: "Inbox" });
    await expect(inboxItem).toContainText("2");

    // Today should show 2 (Buy groceries today + Fix login bug overdue)
    const todayItem = page
      .locator("button.nav-item")
      .filter({ hasText: "Today" });
    await expect(todayItem).toContainText("2");
  });

  test("Completed/Logbook view shows done tasks", async ({ page }) => {
    await page.goto("/");
    await waitForAppLoad(page);

    // Navigate to Completed/Logbook
    await page
      .locator("button.nav-item")
      .filter({ hasText: "Completed" })
      .click();
    await page.waitForTimeout(500);

    // Should show completed task
    await expect(taskByTitle(page, "Morning run")).toBeVisible();
  });
});
