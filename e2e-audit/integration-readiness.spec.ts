import { expect, login, test } from "./harness";

test("lectura de proveedores exige superadmin aun por API directa", async ({ page }) => {
  const anonymous = await page.request.get("/api/admin/integrations/readiness", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(403);
  expect(anonymous.headers()["cache-control"]).toContain("no-store");
  await login(page, "ownerA");
  const owner = await page.request.get("/api/admin/integrations/readiness", { maxRedirects: 0 });
  expect(owner.status()).toBe(403);
  expect(await owner.json()).toEqual({ error: "platform_admin_required" });
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
