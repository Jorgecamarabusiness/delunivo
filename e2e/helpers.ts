import type { Page } from "@playwright/test";

export const MAIN_COURSE_ID = "11111111-1111-1111-1111-111111111111";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. En local: node --env-file... o revisa .env.e2e.local ` +
        `(créalo con scripts/seed-e2e-users.mjs). En CI: añádela como Secret del repo.`
    );
  }
  return value;
}

export const ACCOUNTS = {
  admin: {
    email: requiredEnv("E2E_ADMIN_EMAIL"),
    password: requiredEnv("E2E_ADMIN_PASSWORD"),
  },
  student: {
    email: requiredEnv("E2E_STUDENT_EMAIL"),
    password: requiredEnv("E2E_STUDENT_PASSWORD"),
  },
  noAccess: {
    email: requiredEnv("E2E_NOACCESS_EMAIL"),
    password: requiredEnv("E2E_NOACCESS_PASSWORD"),
  },
};

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/cursos\//);
}
