import { expect, test } from "@playwright/test";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";
import { ACCOUNTS, adminClient, login } from "./helpers";

test.describe.configure({ mode: "serial" });

let superAdminOrg: TestOrg;

test.beforeAll(async () => {
  superAdminOrg = await createTestOrg({ namePrefix: "Control Delunivo" });
  const { error } = await adminClient()
    .from("profiles")
    .update({ is_super_admin: true })
    .eq("id", superAdminOrg.owner.id);
  if (error) throw error;
});

test.afterAll(async () => {
  await destroyTestOrg(superAdminOrg);
});

test("el superadministrador controla precio, empresas y correos desde una sola página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(
    page,
    superAdminOrg.owner.email,
    superAdminOrg.owner.password,
    superAdminOrg.prefix
  );
  await page.goto("/admin/plataforma");

  await expect(page.getByRole("heading", { name: "Control de Delunivo" })).toBeVisible();
  await expect(page.getByLabel("Precio mensual")).toHaveValue("30.00");
  await expect(page.getByRole("heading", { name: "Empresas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Correos de prueba" })).toBeVisible();
  await expect(page.getByText(/Envío desactivado/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Control Delunivo" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Control de Delunivo" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test("un administrador de empresa no ve ni puede usar el control de plataforma", async ({
  page,
}) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto("/admin/plataforma");

  await expect(page.getByText("No tienes permisos de super administrador.")).toBeVisible();
  await expect(page.getByLabel("Precio mensual")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Control Delunivo" })).toHaveCount(0);
});
