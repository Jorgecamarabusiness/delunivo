import { test, expect } from "@playwright/test";
import { adminClient } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

// Fase 7: /register en el dominio raíz (o en un slug inexistente) no debe
// ofrecer nunca un registro de alumno; en /o/<slug> sí, y además debe entrar
// al roster de esa organización (bug real encontrado y arreglado en la Fase
// 7 — antes no insertaba nada en organization_students).

let org: TestOrg;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Autorregistro" });
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

test("/register en el dominio raíz redirige a la landing de registro de empresas", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("Nombre de tu empresa")).toBeVisible();
});

test("/o/<slug-inexistente>/register también cae a la landing, no rompe", async ({ page }) => {
  await page.goto(`/o/no-existe-${Date.now()}/register`);
  await expect(page).toHaveURL("/");
});

test("registrarse en /o/<slug> mete al alumno en el roster de esa organización", async ({ page }) => {
  const email = `e2e-selfregister-${Date.now()}@example.com`;

  await page.goto(`${org.prefix}/register`);
  await page.getByLabel("Nombre completo").fill("Alumno E2E");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Test-Aa1-2345");
  await page.getByLabel("Confirmar contraseña").fill("Test-Aa1-2345");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // OJO: getByRole("alert") a secas también matchea el "route announcer" que
  // inyecta el propio Next.js (siempre presente en el DOM, técnicamente
  // "visible" para Playwright aunque esté oculto por CSS) — hay que
  // acotarlo al <form>, si no la carrera de abajo se resuelve al instante
  // contra ese elemento vacío en vez de esperar al error real de la action.
  const alert = page.locator("form").getByRole("alert");
  const checkEmail = page.getByText("Revisa tu correo");

  // Con "Confirm email" activo (el caso real de este proyecto) no hay sesión
  // inmediata y se queda en la propia página mostrando "Revisa tu correo" (o
  // un error). Si algún día se desactivara, signUp() da sesión al momento y
  // redirige directo a /cursos — se contempla igualmente para no asumir la
  // configuración actual del dashboard de Supabase.
  await Promise.race([
    page.waitForURL((url) => url.pathname.startsWith(`${org.prefix}/cursos`)),
    alert.waitFor({ state: "visible" }),
    checkEmail.waitFor({ state: "visible" }),
  ]);

  const alertText = (await alert.count()) > 0 ? await alert.textContent() : "";
  test.skip(
    /rate limit/i.test(alertText ?? ""),
    "Supabase alcanzó el límite de envío de emails de auth en este proyecto — límite externo, no un bug (ver docs/database.md)."
  );

  const admin = adminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const createdUser = usersList.users.find((u) => u.email === email);
  expect(createdUser).toBeTruthy();
  org.extraUserIds.push(createdUser!.id);

  const { data: membership } = await admin
    .from("organization_students")
    .select("status, joined_via")
    .eq("organization_id", org.orgId)
    .eq("user_id", createdUser!.id)
    .single();
  expect(membership?.status).toBe("active");
  expect(membership?.joined_via).toBe("self_register");
});
