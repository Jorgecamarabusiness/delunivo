import { expect, test as base, type Page, type TestInfo } from "@playwright/test";
import { accounts, ids } from "../scripts/audit-fixtures.mjs";

export { accounts, expect, ids };

/** Toda prueba aborta tráfico de navegador fuera de los dos servidores locales. */
export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const expectedProcessing = message.text() === "Failed to load resource: the server responded with a status of 409 (Conflict)" &&
        testInfo.annotations.some((annotation) => annotation.type === "expected-http-409" && annotation.description === message.location().url);
      if (!expectedProcessing) failures.push(`console: ${message.text()}`);
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) await route.continue();
      else {
        failures.push(`blocked network: ${route.request().method()} ${url.origin}`);
        await route.abort("blockedbyclient");
      }
    });
    await runTest(page);
    expect(failures, failures.join("\n")).toEqual([]);
  },
});

export async function login(page: Page, role: keyof typeof accounts & string) {
  const account = accounts[role];
  if (!account) throw new Error("El rol anónimo no puede iniciar sesión.");
  await page.context().clearCookies();
  await page.goto("/o/audit-org-a/login");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** Falla ante consola o red no local, para que una fixture no oculte tráfico real. */
export async function captureResponsive(page: Page, testInfo: TestInfo, name = "landing") {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const evidencePath = `docs/evidencias/2026-09-06/${name}-${width}.png`;
    const image = await page.screenshot({ fullPage: true, path: evidencePath });
    await testInfo.attach(`${name}-${width}.png`, { body: image, contentType: "image/png" });
  }
}
