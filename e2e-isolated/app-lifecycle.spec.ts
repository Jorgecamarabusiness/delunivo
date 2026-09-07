import { expect, test } from "@playwright/test";
import { appFixture } from "./fixtures";

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
  await page.getByRole("button", { name: /inicia sesi/i }).click();
  await page.waitForURL(new RegExp(`${base}/cursos`));
}

test("el alumno obtiene un curso gratuito sin Stripe Connect y solo entra a su aula", async ({ page }) => {
  await login(page, appFixture.learner);
  await page.goto(`${base}/cursos/${appFixture.freeCourse}`);
  await page.getByRole("button", { name: "Accede gratis" }).click();
  await page.waitForURL(new RegExp(`${base}/cursos/${appFixture.freeCourse}/aprender`));
  await expect(page.getByText(/Curso E2E gratuito/i)).toBeVisible();
  await page.goto(`${base}/cursos/${appFixture.paidCourse}/aprender`);
  await expect(page).toHaveURL(new RegExp(`${base}/cursos/${appFixture.paidCourse}$|${base}/login`));
});

test("los cursos de pago, borrador y alumnos retirados no conceden acceso gratuito", async ({ page }) => {
  await login(page, appFixture.removed);
  await page.goto(`${base}/cursos/${appFixture.freeCourse}`);
  await page.getByRole("button", { name: "Accede gratis" }).click();
  await expect(page.getByText(/ya no puede acceder|no se puede activar/i)).toBeVisible();
  await page.goto(`${base}/cursos/${appFixture.paidCourse}`);
  await expect(page.getByRole("button", { name: "Accede gratis" })).toHaveCount(0);
  const draftResponse = await page.goto(`${base}/cursos/${appFixture.draftCourse}`);
  expect(draftResponse?.status()).toBe(404);
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
  await expect(page.getByText(appFixture.learner.email)).toBeVisible();
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
