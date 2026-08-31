import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, MAIN_COURSE_ID, IVANORGANICO_PREFIX } from "./helpers";

// /admin nunca lleva prefijo (la organización se resuelve por membership, no
// por la URL — ver docs/database.md, "Enrutamiento por RUTA"). Las rutas
// públicas de curso sí lo llevan.
const LESSON_URL = `${IVANORGANICO_PREFIX}/cursos/${MAIN_COURSE_ID}/aprender`;

test.describe("control de acceso", () => {
  test("sin sesión, /admin redirige a /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sin sesión, la vista de lección redirige a /login", async ({ page }) => {
    await page.goto(LESSON_URL);
    await expect(page).toHaveURL(/\/login/);
  });

  test("un alumno sin compra no puede entrar a /admin", async ({ page }) => {
    await login(page, ACCOUNTS.noAccess.email, ACCOUNTS.noAccess.password);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("un alumno sin compra que intenta ver la lección vuelve a la ficha del curso", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.noAccess.email, ACCOUNTS.noAccess.password);
    await page.goto(LESSON_URL);
    await expect(page).toHaveURL(
      new RegExp(`${IVANORGANICO_PREFIX}/cursos/${MAIN_COURSE_ID}$`)
    );
  });

  test("el admin entra a /admin", async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("un alumno con compra entra a la vista de la lección", async ({ page }) => {
    await login(page, ACCOUNTS.student.email, ACCOUNTS.student.password);
    await page.goto(LESSON_URL);
    await expect(page).toHaveURL(new RegExp(`${IVANORGANICO_PREFIX}/cursos/${MAIN_COURSE_ID}/aprender`));
  });
});

test("un alumno ve sus cursos comprados en el perfil", async ({ page }) => {
  await login(page, ACCOUNTS.student.email, ACCOUNTS.student.password);
  await page.goto("/perfil");

  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByText("Comprado").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar curso" }).first()).toBeVisible();
});
