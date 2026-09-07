import { defineConfig, devices } from "@playwright/test";

const port = 3219;
export default defineConfig({
  testDir: "./e2e-isolated",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "chromium-isolated", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node scripts/isolated-app-e2e.mjs", url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 300_000 },
});
