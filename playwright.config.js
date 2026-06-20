import { defineConfig, devices } from "@playwright/test";

// Browser E2E lives in e2e/ (node:test unit suite lives in tests/).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  workers: 1, // Sync tests need serial execution with shared mock state
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Desktop UI (rendered at "/") + cross-instance sync tests (which spin up
      // their own desktop/mobile pages) both run under a desktop viewport.
      name: "desktop-chrome",
      testMatch: /(desktop|sync|storage)\.spec\.js/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Mobile UI is served at "/mobile" and is layout-sensitive, so the mobile
      // spec only runs under phone viewports.
      name: "mobile-chrome",
      testMatch: /mobile\.spec\.js/,
      use: {
        ...devices["Pixel 7"],
      },
    },
    {
      name: "mobile-safari",
      testMatch: /mobile\.spec\.js/,
      use: {
        ...devices["iPhone 14"],
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
