import { test, expect, login } from "./harness";

test("owner fiscal form is responsive and rejects Canary domicile before opening Checkout", async ({ page }) => {
  await login(page, "ownerB");
  await page.goto("/admin/facturacion");
  await expect(page.getByRole("group", { name: "Domicilio fiscal de la escuela" })).toBeVisible();
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/evidencias/plans-2026-10-01/fiscal-${width}.png`, fullPage: true });
  }
  await page.getByLabel("Nombre o razón social").fill("Escuela fiscal sintética");
  await page.getByLabel("Dirección fiscal", { exact: true }).fill("Calle de Prueba 1");
  await page.getByLabel("Localidad", { exact: true }).fill("Las Palmas");
  await page.getByLabel("Código postal", { exact: true }).fill("35001");
  await page.getByRole("checkbox", { name: /Confirmo que este es el domicilio/ }).check();
  await page.getByRole("checkbox", { name: /Acepto esta oferta/ }).check();
  await page.getByRole("button", { name: "Contratar el plan", exact: true }).click();
  await expect(page.getByText(/Este piloto admite domicilios fiscales de España/)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/facturacion/);
});
