import { defineConfig, devices } from "@playwright/test";

/** Suite aislada: no usa .env.local, bases reales ni el config E2E existente. */
export default defineConfig({
  testDir: "./e2e-audit",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3217", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "chromium-audit", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node scripts/audit-server.mjs", url: "http://localhost:3217", reuseExistingServer: false, timeout: 120_000 },
});
