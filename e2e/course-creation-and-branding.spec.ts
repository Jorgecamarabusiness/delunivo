import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

test.describe.configure({ mode: "serial" });

let org: TestOrg;
const courseTitle = `Curso de prueba E2E ${Date.now()}`;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Curso y Marca" });
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

test("crear un curso desde /admin/cursos lo deja en borrador y lo lista", async ({ page }) => {
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/cursos");
  await page.getByLabel("Título del nuevo curso").fill(courseTitle);
  await page.getByLabel("Precio").fill("49.90");
  await page.getByRole("button", { name: "Crear curso" }).click();

  await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]+$/);

  await page.goto("/admin/cursos");
  await expect(page.getByText(courseTitle)).toBeVisible();
});

test("editar la marca cambia el nombre visible en el portal público", async ({ page }) => {
  const newName = `Marca Actualizada ${Date.now()}`;

  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/marca");
  await page.getByLabel("Nombre", { exact: true }).fill(newName);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  await page.goto(org.prefix + "/");
  await expect(page.locator("header")).toContainText(newName);
});
