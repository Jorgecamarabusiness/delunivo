import { test, expect } from "@playwright/test";

test("publica documentos legales y los enlaza desde el footer", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Aviso legal", "Privacidad", "Condiciones"]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }

  await page.getByRole("link", { name: "Privacidad" }).click();
  await expect(page.getByRole("heading", { name: "Política de privacidad" })).toBeVisible();
});

test("robots, sitemap, 404 de tenant y cabeceras de seguridad", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap: https://www.delunivo.com/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("https://www.delunivo.com/privacidad");

  const missingTenant = await request.get("/o/no-existe-e2e-404");
  expect(missingTenant.status()).toBe(404);

  const home = await request.get("/");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("la portada funciona en móvil sin desbordamiento horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
  await expect(
    page.getByRole("link", { name: "Iniciar sesión" }).first()
  ).toBeVisible();
});
