import { captureResponsive, expect, login, test } from "./harness";

test("lectura de proveedores exige superadmin aun por API directa", async ({ page }) => {
  const anonymous = await page.request.get("/api/admin/integrations/readiness", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(403);
  expect(anonymous.headers()["cache-control"]).toContain("no-store");
  await login(page, "ownerA");
  const owner = await page.request.get("/api/admin/integrations/readiness", { maxRedirects: 0 });
  expect(owner.status()).toBe(403);
  expect(await owner.json()).toEqual({ error: "platform_admin_required" });
});

test("estado de servicios privado muestra desconocido y controles en todos los tamaños", async ({ page }, testInfo) => {
  await login(page, "ownerA");
  await page.goto("/admin/plataforma/servicios");
  await expect(page).toHaveURL(/\/admin$/);
  await page.waitForLoadState("networkidle");
  await login(page, "superadmin");
  await page.goto("/admin/plataforma");
  await page.getByRole("link", { name: "Estado de servicios", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estado de servicios", exact: true })).toBeVisible();
  await expect(page.getByText("Estado de Stripe desconocido.", { exact: false })).toBeVisible();
  await expect(page.getByText("Estado de Mux desconocido.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar catálogo LIVE", exact: true })).toBeDisabled();
  await page.getByText("Detalles de la comprobación", { exact: true }).click();
  await expect(page.locator("details pre")).toContainText('"state": "unknown"');
  await expect(page.locator("details pre")).not.toContainText("sk_test_");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await page.getByRole("link", { name: "Volver al control de plataforma" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByText("Detalles de la comprobación", { exact: true }).click();
  await captureResponsive(page, testInfo, "services");
});

test("superadmin recibe estado desconocido con proveedores aislados, sin secretos", async ({ page }) => {
  await login(page, "superadmin");
  const response = await page.request.get("/api/admin/integrations/readiness");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.account).toEqual({ state: "unknown" });
  expect(body.mux).toEqual({ state: "unknown" });
  expect(JSON.stringify(body)).not.toMatch(/sk_test_|audit-mux-webhook-secret|audit-service-role-key/);
});
