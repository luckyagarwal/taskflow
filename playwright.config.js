import { defineConfig, devices } from "@playwright/test";

// Browser E2E lives in e2e/ (node:test unit suite lives in tests/).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
