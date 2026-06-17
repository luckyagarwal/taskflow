import { test, expect } from "@playwright/test";

// Regression for the parsing-preview fix: typing natural-language tokens must
// light up the composer's Date / Priority / Label / Project pills live.
test("composer preview pills reflect parsed tokens", async ({ page }) => {
  await page.goto("/taskApp/");

  // Open the first inline "Add task" composer.
  await page.getByRole("button", { name: "Add task" }).first().click();

  const input = page.getByPlaceholder("Task name");
  await expect(input).toBeVisible();
  await input.fill("Launch plan p1 tomorrow #Work @deep");

  // The composer root is the input's parent div; scope assertions to it so we
  // don't match task-list text elsewhere on the page.
  const composer = input.locator("..");
  await expect(composer.getByText("Tomorrow", { exact: false })).toBeVisible();
  await expect(composer.getByText("P1", { exact: true })).toBeVisible();
  await expect(composer.getByText("1 label", { exact: false })).toBeVisible();
  await expect(composer.getByText("Work", { exact: false })).toBeVisible();
});
