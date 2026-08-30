import crypto from "node:crypto";
import { test, expect } from "@playwright/test";
import { login, adminClient } from "./helpers";
import { createTestOrg, destroyTestOrg, hashInvitationTokenForTest, type TestOrg } from "./fixtures";

// Ciclo de vida completo de una invitación de alumno: invitar desde la UI →
// aceptar (crea la cuenta) → aparece en el roster → echar → cambia de
// estado. No se puede interceptar el email real de Resend desde el test, así
// que la parte de "aceptar" inserta su propia invitación con un token
// conocido (mismo hash que usa la app) en vez de depender del correo.

test.describe.configure({ mode: "serial" });

let org: TestOrg;
let courseId: string;
const courseTitle = "Curso incluido en la invitación";
const invitedEmail = `e2e-invitado-${Date.now()}@example.com`;
const acceptEmail = `e2e-acepta-${Date.now()}@example.com`;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Invitaciones" });
  const { data: course, error } = await adminClient()
    .from("courses")
    .insert({
      organization_id: org.orgId,
      title: courseTitle,
      description: "",
      long_description: "",
      price: 25,
      learning_points: [],
      status: "published",
    })
    .select("id")
    .single();
  if (error || !course) throw error ?? new Error("No se pudo crear el curso E2E.");
  courseId = course.id;
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

test("invitar a un alumno desde /admin/usuarios crea una invitación pendiente", async ({ page }) => {
  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/usuarios");

  await page.getByPlaceholder("correo@alumno.com").fill(invitedEmail);
  await page.getByText(courseTitle, { exact: true }).click();
  await page.getByRole("button", { name: "Enviar invitación" }).click();

  // La invitación se guarda ANTES de mandar el correo, y si el envío falla por
  // un motivo externo (Resend sin dominio verificado o sin clave válida en CI)
  // la action lo dice sin perder la invitación. Lo que se prueba aquí es que la
  // invitación existe y se lista, no que Resend esté configurado.
  await expect(
    page
      .getByText("Invitación enviada.")
      .or(page.getByText(/no se pudo enviar el correo/i))
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: invitedEmail })).toBeVisible();

  const admin = adminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, status, invite_type")
    .eq("organization_id", org.orgId)
    .eq("email", invitedEmail)
    .single();

  expect(invitation?.status).toBe("pending");
  expect(invitation?.invite_type).toBe("student");
});

test("aceptar la invitación crea la cuenta, entra al roster y redirige a los cursos de esa organización", async ({
  page,
}) => {
  const admin = adminClient();
  const token = crypto.randomBytes(32).toString("hex");

  const { data: invitation, error } = await admin
    .from("invitations")
    .insert({
      organization_id: org.orgId,
      email: acceptEmail,
      invite_type: "student",
      token_hash: hashInvitationTokenForTest(token),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !invitation) throw error ?? new Error("No se pudo crear la invitación E2E.");

  const { error: courseError } = await admin.from("invitation_courses").insert({
    invitation_id: invitation.id,
    course_id: courseId,
  });
  if (courseError) throw courseError;

  await page.goto(`/invitaciones/${token}`);
  await expect(page.getByText(acceptEmail)).toBeVisible();

  await page.getByLabel("Elige una contraseña").fill("Test-Aa1-2345");
  await page.getByLabel("Confirma la contraseña").fill("Test-Aa1-2345");
  await page.getByRole("button", { name: "Crear cuenta y aceptar" }).click();

  await page.waitForURL((url) => url.pathname.startsWith(`${org.prefix}/cursos`));

  const { data: createdUser } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", acceptEmail)
    .single();
  expect(createdUser).toBeTruthy();
  org.extraUserIds.push(createdUser!.id);

  const { data: membership } = await admin
    .from("organization_students")
    .select("status, joined_via")
    .eq("organization_id", org.orgId)
    .eq("user_id", createdUser!.id)
    .single();
  expect(membership?.status).toBe("active");
  expect(membership?.joined_via).toBe("invite");

  const { data: courseAccess } = await admin
    .from("student_course_access")
    .select("course_id")
    .eq("user_id", createdUser!.id)
    .eq("course_id", courseId)
    .single();
  expect(courseAccess?.course_id).toBe(courseId);

  await page.context().clearCookies();
  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("cell", { name: acceptEmail })).toBeVisible();
});

test("echar a un alumno le cambia el estado a 'Echado' en el roster", async ({ page }) => {
  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/usuarios");

  const row = page.getByRole("row", { name: new RegExp(acceptEmail) });
  await expect(row.getByText("Activo")).toBeVisible();

  await row.getByRole("button", { name: "Echar" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Echar alumno" });
  await dialog
    .getByPlaceholder("Ejemplo: devolución solicitada")
    .fill("Prueba automática");
  await dialog.getByRole("button", { name: "Echar alumno" }).click();

  await expect(row.getByText("Echado")).toBeVisible();
});
