import { test, expect, login, ids } from "../e2e-audit/harness";

test("paused personal project has no sales or signup forms at mobile, tablet and desktop widths", async ({ page }, testInfo) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Delunivo · proyecto personal" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Crear mi empresa|Crear mi escuela|Empezar con|Solicitar contacto/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`personal-preview-${width}.png`), fullPage: true });
    for (const route of ["/crear-empresa", "/a-medida"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Proyecto personal en pausa" })).toBeVisible();
      await expect(page.locator("input[name=companyName],textarea[name=message]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("paid course has no purchase option while an existing student's access remains available", async ({ page }) => {
  const path = `/o/audit-org-a/cursos/${ids.courseA}`;
  await page.goto(path);
  await expect(page.getByText("Proyecto personal en pausa. Las nuevas contrataciones y compras están desactivadas.").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar con tarjeta" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inicia sesión para comprar" })).toHaveCount(0);
  await login(page, "studentA");
  await page.goto(path);
  await expect(page.getByText("Ya tienes acceso a este curso.").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al curso →" }).filter({ visible: true }).first()).toBeVisible();
});

test("owner retains saved billing data, reconciliation and export without reopening purchases", async ({ page }) => {
  await login(page, "ownerA");
  await page.goto("/admin/facturacion");
  await expect(page.getByRole("heading", { name: /Consumo y capacidad/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar pago" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar pago" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Comprar bolsa|Contratar el plan|Suscribirse ahora|Reactivar suscripción/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Extraer tus datos y contenido disponible" })).toBeVisible();
});
