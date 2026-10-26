import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-personal-preview",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:3217", screenshot: "only-on-failure" },
  projects: [{ name: "chromium-personal-preview", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node scripts/audit-server.mjs --personal-preview", url: "http://localhost:3217", reuseExistingServer: false, timeout: 120_000 },
});
