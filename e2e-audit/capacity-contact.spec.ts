import { test, expect, login } from "./harness";

test("solicitud a medida y validación de evidencia presentan éxito y error accesibles", async ({
  page,
}) => {
  await login(page, "ownerA");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/a-medida");
    await expect(
      page.getByRole("heading", { name: "Un plan a medida" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/evidencias/plans-2026-10-01/custom-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByLabel("Tus necesidades")
    .fill("Escuela sintética: 200 horas de biblioteca y capacidad acordada.");
  await page.getByRole("button", { name: "Registrar solicitud" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Solicitud registrada" }),
  ).toContainText("no has contratado ni pagado un plan");
  await page.screenshot({
    path: "docs/evidencias/plans-2026-10-01/custom-success.png",
    fullPage: true,
  });
  await login(page, "superadmin");
  await page.goto("/admin/plataforma");
  await page.getByLabel("Evidencia JSON (statement y lines)").fill("{}");
  await page.getByRole("button", { name: "Registrar fuente" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /evidencia|fuente|statement|incompleto|inválid/i }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/evidencias/plans-2026-10-01/provider-error.png",
    fullPage: true,
  });
});
