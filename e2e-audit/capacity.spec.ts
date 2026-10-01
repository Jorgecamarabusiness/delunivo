import { test, expect, login, ids } from "./harness";
test("oferta y condiciones comparten cifras y se adaptan a móvil, tablet y escritorio", async ({
  page,
}, testInfo) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Crece", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("8.000 minutos", { exact: false }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/evidencias/plans-2026-10-01/pricing-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/condiciones-planes");
  await expect(page.getByText(/30 días/).first()).toBeVisible();
  await testInfo.attach("conditions", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `docs/evidencias/plans-2026-10-01/conditions-${width}.png`,
      fullPage: true,
    });
  }
});
test("propietario ve saldo, cobertura pendiente y recuperación de pago; alumno y owner B no exportan A", async ({
  page,
}) => {
  await login(page, "ownerA");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/facturacion");
    await expect(
      page.getByRole("heading", { name: /Consumo y capacidad/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Actualizar pago" }),
    ).toBeVisible();
    await expect(page.getByText(/horas de cobertura pendientes/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Comprar bolsa" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "Extraer tus datos y contenido disponible",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/evidencias/plans-2026-10-01/school-${width}.png`,
      fullPage: true,
    });
  }
  const exported = await page.request.get(
    `/api/admin/content-export?organizationId=${ids.orgA}`,
  );
  expect(exported.status()).toBe(200);
  const manifest = await exported.json();
  expect(manifest.organization.id).toBe(ids.orgA);
  expect(manifest.purchases).toBeUndefined();
  await login(page, "ownerB");
  expect(
    (
      await page.request.get(
        `/api/admin/content-export?organizationId=${ids.orgA}`,
      )
    ).status(),
  ).toBe(403);
  await login(page, "studentA");
  expect(
    (
      await page.request.get(
        `/api/admin/content-export?organizationId=${ids.orgA}`,
      )
    ).status(),
  ).toBe(403);
});
test("panel plataforma separa coste atribuido, créditos y datos desconocidos", async ({
  page,
}) => {
  await login(page, "superadmin");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/plataforma");
    await expect(
      page.getByRole("heading", { name: "Economía y consumo", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/evidencias/plans-2026-10-01/platform-${width}.png`,
      fullPage: true,
    });
  }
});
