import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MAIN_COURSE_ID = "11111111-1111-1111-1111-111111111111";

// Desde la Fase 6, el dominio raíz es la landing de registro de empresas —
// ya no resuelve ninguna organización. Todo lo que antes vivía en "/" ahora
// vive en /o/<slug> (ver la sección "Enrutamiento por RUTA" en docs/database.md).
export const IVANORGANICO_PREFIX = "/o/ivanorganico";
export const CLIENTE_PRUEBA_PREFIX = "/o/cliente-prueba";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. En local: revisa .env.e2e.local ` +
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

/**
 * Inicia sesión dentro de la zona /o/<orgPrefix> indicada (por defecto la de
 * ivanorganico, donde viven las 3 cuentas fijas de arriba). No asume a qué
 * ruta exacta redirige tras el login (puede ser el listado de /cursos o la
 * ficha de un curso concreto si solo hay uno publicado) — solo que se queda
 * dentro del mismo prefijo.
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  orgPrefix: string = IVANORGANICO_PREFIX
) {
  await page.goto(`${orgPrefix}/login`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(`${orgPrefix}/cursos`));
}

/** Cliente admin (service role) para arreglar/leer datos directamente desde los tests. */
export function adminClient(): SupabaseClient {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
}
