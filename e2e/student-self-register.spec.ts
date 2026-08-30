import crypto from "node:crypto";
import { test, expect } from "@playwright/test";
import { adminClient } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

// /register nunca se ofrece en el dominio raíz (ahí "registrarse" es crear una
// empresa); en /o/<slug> sí, y además mete al alumno en el roster de esa
// organización. Cubre también la verificación por código de 30 minutos que
// sustituyó al email de confirmación de Supabase.

let org: TestOrg;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Autorregistro" });
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

test("/register en el dominio raíz redirige a la landing de Delunivo", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: /Crea, vende y comparte conocimiento/i })
  ).toBeVisible();
});

test("/o/<slug-inexistente>/register también cae a la landing, no rompe", async ({ page }) => {
  await page.goto(`/o/no-existe-${Date.now()}/register`);
  await expect(page).toHaveURL("/");
});

test("registrarse en /o/<slug> mete al alumno en el roster y le pide el código", async ({
  page,
}) => {
  const email = `e2e-selfregister-${Date.now()}@example.com`;

  await page.goto(`${org.prefix}/register`);
  await page.getByLabel("Nombre completo").fill("Alumno E2E");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Test-Aa1-2345");
  await page.getByLabel("Confirmar contraseña").fill("Test-Aa1-2345");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // OJO: getByRole("alert") a secas también matchea el "route announcer" que
  // inyecta Next.js en todas las páginas — hay que acotarlo al <form>.
  const alert = page.locator("form").getByRole("alert");

  // La cuenta y el roster se crean ANTES de mandar el email, así que el estado
  // en base de datos es el mismo tanto si el envío funciona (redirige a
  // /verificar) como si falla por un motivo externo (Resend sin clave válida en
  // CI, por ejemplo) y se queda en el formulario mostrando el error.
  await Promise.race([
    page.waitForURL((url) => url.pathname.startsWith(`${org.prefix}/verificar`)),
    alert.waitFor({ state: "visible" }),
  ]);

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .single();
  expect(profile).toBeTruthy();
  org.extraUserIds.push(profile!.id);

  const { data: membership } = await admin
    .from("organization_students")
    .select("status, joined_via")
    .eq("organization_id", org.orgId)
    .eq("user_id", profile!.id)
    .single();
  expect(membership?.status).toBe("active");
  expect(membership?.joined_via).toBe("self_register");
});

test("el código de verificación confirma la cuenta y deja entrar", async ({ page }) => {
  const email = `e2e-verifica-${Date.now()}@example.com`;
  const admin = adminClient();

  // La cuenta se crea igual que la crea el registro: sin confirmar.
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "Test-Aa1-2345",
    email_confirm: false,
    user_metadata: { name: "Alumno Verifica" },
  });
  if (error || !created.user) throw error ?? new Error("No se pudo crear el usuario.");
  org.extraUserIds.push(created.user.id);

  // El código en claro nunca se guarda (solo su SHA-256), así que el test
  // inserta el suyo con un valor conocido — mismo patrón que invitations.spec.ts
  // con el token de invitación.
  const code = "246810";
  const { error: codeError } = await admin.from("verification_codes").insert({
    email: email.toLowerCase(),
    code_hash: crypto.createHash("sha256").update(code).digest("hex"),
    purpose: "signup",
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (codeError) throw codeError;

  await page.goto(
    `${org.prefix}/verificar?email=${encodeURIComponent(email)}&next=${encodeURIComponent(
      `${org.prefix}/cursos`
    )}`
  );
  await page.getByLabel("Código de verificación").fill(code);
  await page.getByRole("button", { name: "Confirmar" }).click();

  await page.waitForURL((url) => url.pathname.startsWith(`${org.prefix}/cursos`));

  // Y la cuenta queda confirmada en Supabase, así que ya puede iniciar sesión.
  const { data: refreshed } = await admin.auth.admin.getUserById(created.user.id);
  expect(refreshed.user?.email_confirmed_at).toBeTruthy();
});

test("un código incorrecto no confirma la cuenta", async ({ page }) => {
  const email = `e2e-codigomal-${Date.now()}@example.com`;
  const admin = adminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "Test-Aa1-2345",
    email_confirm: false,
  });
  if (error || !created.user) throw error ?? new Error("No se pudo crear el usuario.");
  org.extraUserIds.push(created.user.id);

  await admin.from("verification_codes").insert({
    email: email.toLowerCase(),
    code_hash: crypto.createHash("sha256").update("111111").digest("hex"),
    purpose: "signup",
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  await page.goto(`${org.prefix}/verificar?email=${encodeURIComponent(email)}`);
  await page.getByLabel("Código de verificación").fill("999999");
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.locator("form").getByRole("alert")).toContainText(/incorrecto/i);

  const { data: refreshed } = await admin.auth.admin.getUserById(created.user.id);
  expect(refreshed.user?.email_confirmed_at).toBeFalsy();
});
