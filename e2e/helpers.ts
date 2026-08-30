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

/**
 * Cliente normal que reutiliza la sesión ya abierta por Playwright. Así se
 * comprueba RLS sin service role y sin duplicar inicios de sesión en Supabase.
 */
export async function authenticatedClientFromPage(
  page: Page
): Promise<SupabaseClient> {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const cookies = await page.context().cookies();
  const direct = cookies.find((cookie) => cookie.name === storageKey)?.value;
  const chunked = cookies
    .filter((cookie) => cookie.name.startsWith(`${storageKey}.`))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map((cookie) => cookie.value)
    .join("");
  let serialized = direct ?? chunked;
  if (serialized.startsWith("base64-")) {
    serialized = Buffer.from(serialized.slice(7), "base64url").toString("utf8");
  }

  let session: { access_token?: string };
  try {
    session = JSON.parse(serialized) as { access_token?: string };
  } catch {
    session = JSON.parse(decodeURIComponent(serialized)) as {
      access_token?: string;
    };
  }
  if (!session.access_token) {
    throw new Error("La sesión de Playwright no contiene un access token.");
  }

  const client = createClient(
    supabaseUrl,
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
  return client;
}
