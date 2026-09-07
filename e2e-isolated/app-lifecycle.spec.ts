import { expect, test } from "@playwright/test";
import { appFixture } from "./fixtures";
import { execFileSync } from "node:child_process";

const base = `/o/${appFixture.orgSlug}`;
test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) ? route.continue() : route.abort("blockedbyclient");
  });
});

async function login(page: import("@playwright/test").Page, account: { email: string; password: string }) {
  await page.goto(`${base}/login`);
  await page.getByLabel(/correo/i).fill(account.email);
  await page.getByLabel(/contrase/i).fill(account.password);
  await page.getByRole("button", { name: /iniciar sesi/i }).click();
  await page.waitForURL(new RegExp(`${base}/cursos`));
  await page.waitForLoadState("networkidle");
}

test("el alumno obtiene un curso gratuito sin Stripe Connect y solo entra a su aula", async ({ page }) => {
  await login(page, appFixture.learner);
  await page.goto(`${base}/cursos/${appFixture.freeCourse}`);
  await page.getByRole("button", { name: "Accede gratis" }).click();
  await page.waitForURL(new RegExp(`${base}/cursos/${appFixture.freeCourse}/aprender`));
  await expect(page.getByRole("heading", { name: "Curso E2E gratuito", exact: true })).toBeVisible();
  await page.goto(`${base}/cursos/${appFixture.paidCourse}/aprender`);
  await expect(page).toHaveURL(new RegExp(`${base}/cursos/${appFixture.paidCourse}$|${base}/login`));
  const confirmation = await page.request.get(`/api/purchases/${appFixture.receipt}/confirmation`);
  expect(confirmation.status()).toBe(200);
  expect(confirmation.headers()["content-disposition"]).toContain("attachment");
  expect(await confirmation.text()).toContain("No se conserva una copia de la oferta original");
});

test("los cursos de pago, borrador y alumnos retirados no conceden acceso gratuito", async ({ page }) => {
  await login(page, appFixture.removed);
  expect((await page.request.get(`/api/purchases/${appFixture.receipt}/confirmation`)).status()).toBe(404);
  await page.goto(`${base}/cursos/${appFixture.freeCourse}`);
  await page.getByRole("button", { name: "Accede gratis" }).click();
  await expect(page.getByText("Tu acceso a esta organización está desactivado.", { exact: true })).toBeVisible();
  await page.goto(`${base}/cursos/${appFixture.paidCourse}`);
  await expect(page.getByRole("button", { name: "Accede gratis" })).toHaveCount(0);
  const draftResponse = await page.goto(`${base}/cursos/${appFixture.draftCourse}`);
  // Next's streamed notFound can retain HTTP 200 after headers were sent.
  // In both forms, verify actual denial, noindex and no draft title leakage.
  expect([200, 404]).toContain(draftResponse?.status());
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Curso E2E borrador", { exact: true })).toHaveCount(0);
});

test("registro y verificación reales conservan la intención del curso gratuito", async ({ page }) => {
  expect((await page.request.get(`/api/purchases/${appFixture.receipt}/confirmation`)).status()).toBe(401);
  await page.goto(`${base}/cursos/${appFixture.freeCourse}`);
  await page.getByRole("link", { name: "Accede gratis", exact: true }).click();
  await page.getByRole("link", { name: "Regístrate", exact: true }).click();
  await page.getByLabel("Nombre completo", { exact: true }).fill("Registro sintético");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("app-e2e-register@synthetic.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Synthetic-register-123!");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("Synthetic-register-123!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.waitForURL(/\/verificar\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(`${base}/cursos/${appFixture.freeCourse}/acceder`);
  execFileSync(process.execPath, ["scripts/isolated-signup-code.mjs", "app-e2e-register@synthetic.invalid"], { stdio: "pipe" });
  await page.getByLabel("Código de verificación", { exact: true }).fill("729184");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.waitForURL(new RegExp(`${base}/cursos/${appFixture.freeCourse}/aprender`));
  await expect(page.getByRole("heading", { name: "Curso E2E gratuito", exact: true })).toBeVisible();
});

test("la eliminacion propia exige reautenticacion y revoca la sesion sintetica", async ({ page }) => {
  await login(page, appFixture.deleting);
  await page.goto("/cuenta/eliminar");
  await page.getByLabel(/correo de la cuenta/i).fill(appFixture.deleting.email);
  await page.getByLabel(/contrase/i).fill(appFixture.deleting.password);
  await page.getByRole("button", { name: /solicitar eliminaci/i }).click();
  await page.waitForURL(/\/cuenta\/eliminacion/);
  await expect(page.getByText("La eliminación de la cuenta se ha completado.")).toBeVisible({ timeout: 30_000 });
  await page.goto(`${base}/perfil`);
  await expect(page).toHaveURL(new RegExp(`${base}/login|/login`));
});

test("superadmin controla Run as y elimina otra identidad sintetica con reautenticacion", async ({ page }) => {
  await login(page, appFixture.superadmin);
  const forgedExit = await page.request.get("/api/support/run-as/exit?session=forged&proof=forged", { maxRedirects: 0 });
  expect(forgedExit.status()).toBe(307);
  expect(forgedExit.headers().location).toContain("/login?runAs=invalid");
  await page.goto("/admin/plataforma");
  await expect(page.getByRole("link", { name: /gestionar cuentas/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run as" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Run as" }).first().click();
  await page.getByRole("button", { name: /iniciar run as/i }).click();
  await expect(page.getByText(/motivo de soporte de entre 5 y 500/i)).toBeVisible();
  await page.goto("/admin/plataforma/cuentas");
  await expect(page.getByRole("row", { name: new RegExp(appFixture.learner.email) })).toBeVisible();
  await page.getByRole("row", { name: new RegExp(appFixture.adminDelete.email) }).getByRole("link", { name: /revisar eliminaci/i }).click();
  await expect(page.getByRole("heading", { name: "Eliminar cuenta" })).toBeVisible();
  await page.getByLabel(/motivo de la eliminaci.n administrativa/i).fill("Solicitud de prueba sintetica");
  await page.getByLabel(/correo de la cuenta/i).fill(appFixture.adminDelete.email);
  await page.getByLabel(/tu contrase/i).fill(appFixture.superadmin.password);
  await page.getByRole("button", { name: /solicitar eliminaci.n de esta cuenta/i }).click();
  await page.waitForURL(/\/cuenta\/eliminacion/);
  await expect(page.getByText("La eliminación de la cuenta se ha completado.")).toBeVisible({ timeout: 30_000 });
  await page.context().clearCookies();
  await page.goto(`${base}/login`);
  await page.getByLabel(/correo/i).fill(appFixture.adminDelete.email);
  await page.getByLabel(/contrase/i).fill(appFixture.adminDelete.password);
  await page.getByRole("button", { name: /iniciar sesi.n/i }).click();
  await expect(page.getByText(/correo o contrase.a incorrectos/i)).toBeVisible();
});
