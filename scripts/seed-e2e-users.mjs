// Crea (o resetea) el tenant, curso y las 3 cuentas fijas de Playwright.
// Es idempotente y está bloqueado contra el proyecto real de producción.
//
// Uso: node --env-file=.env.local scripts/seed-e2e-users.mjs
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";

const PRODUCTION_PROJECT_REF = "jgxqdzmmeveksseflyst";
const MAIN_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const MAIN_COURSE_ID = "11111111-1111-1111-1111-111111111111";
const MAIN_SECTION_ID = "22222222-2222-4222-8222-222222222222";
const MAIN_LESSON_ID = "44444444-4444-4444-8444-444444444444";
const PRIVATE_VIDEO_PATH = "videos/e2e-private-sample.mp4";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan las variables de Supabase. Ejecuta con un entorno E2E no productivo."
  );
  process.exit(1);
}

const targetProjectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === PRODUCTION_PROJECT_REF) {
  throw new Error(
    "Seed E2E bloqueado: NEXT_PUBLIC_SUPABASE_URL apunta a producción. " +
      "Usa una rama efímera o un proyecto dedicado a pruebas."
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function upsertTestUser(email, name, configuredPassword) {
  const password = configuredPassword || `E2E-${crypto.randomBytes(12).toString("hex")}-Aa1`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!error) {
    return { id: data.user.id, email, password, created: true };
  }

  const alreadyExists = error.status === 422 || /already been registered/i.test(error.message);
  if (!alreadyExists) throw error;

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`No se pudo crear ni encontrar ${email}: ${error.message}`);

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (updateError) throw updateError;

  return { id: existing.id, email, password, created: false };
}

async function main() {
  const results = {};

  results.admin = await upsertTestUser(
    "e2e-admin@playwright.test",
    "E2E Admin",
    process.env.E2E_ADMIN_PASSWORD
  );
  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_super_admin: false })
    .eq("id", results.admin.id);
  if (profileError) throw profileError;

  const { error: organizationError } = await admin.from("organizations").upsert({
    id: MAIN_ORGANIZATION_ID,
    name: "Iván Orgánico E2E",
    slug: "ivanorganico",
    owner_id: results.admin.id,
    tagline_template: "Aprende con {admin}",
    hero_subtitle: "Entorno aislado de pruebas end-to-end",
  });
  if (organizationError) throw organizationError;

  const organizationId = MAIN_ORGANIZATION_ID;

  const { error: billingError } = await admin.from("organization_billing").upsert({
    organization_id: organizationId,
    platform_subscription_status: "active",
    platform_stripe_customer_id: "cus_e2e_fixed",
    platform_subscription_id: "sub_e2e_fixed",
  });
  if (billingError) throw billingError;

  const { error: adminMembershipError } = await admin
    .from("organization_admins")
    .upsert(
      { organization_id: organizationId, user_id: results.admin.id, role: "admin" },
      { onConflict: "organization_id,user_id" }
    );
  if (adminMembershipError) throw adminMembershipError;

  const { error: courseError } = await admin.from("courses").upsert({
    id: MAIN_COURSE_ID,
    organization_id: organizationId,
    title: "Curso principal E2E",
    description: "Curso artificial para las pruebas de extremo a extremo.",
    long_description: "Contenido exclusivo del entorno aislado de pruebas.",
    learning_points: ["Validar acceso", "Validar progreso"],
    price: 29.9,
    status: "published",
  });
  if (courseError) throw courseError;

  const { error: sectionError } = await admin.from("sections").upsert({
    id: MAIN_SECTION_ID,
    course_id: MAIN_COURSE_ID,
    title: "Módulo E2E",
    order_index: 0,
    status: "published",
  });
  if (sectionError) throw sectionError;

  const { error: lessonError } = await admin.from("lessons").upsert({
    id: MAIN_LESSON_ID,
    course_id: MAIN_COURSE_ID,
    section_id: MAIN_SECTION_ID,
    title: "Lección E2E",
    order_index: 0,
    status: "published",
    blocks: [
      {
        id: "e2e-private-video-block",
        type: "video_file",
        title: "Vídeo privado E2E",
        video_url: PRIVATE_VIDEO_PATH,
      },
      { id: "e2e-text-block", type: "text", content: "Contenido E2E" },
    ],
  });
  if (lessonError) throw lessonError;

  // El contenido no es un vídeo real: basta una cabecera MP4 sintética para
  // comprobar que la app genera una URL firmada y nunca una URL pública. Vive
  // exclusivamente en el bucket privado del entorno E2E.
  const syntheticMp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  const { error: videoUploadError } = await admin.storage
    .from("lesson-media")
    .upload(PRIVATE_VIDEO_PATH, syntheticMp4Header, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (videoUploadError) throw videoUploadError;

  const { error: featuredError } = await admin
    .from("organizations")
    .update({ featured_course_id: MAIN_COURSE_ID })
    .eq("id", organizationId);
  if (featuredError) throw featuredError;

  results.student = await upsertTestUser(
    "e2e-student-con-compra@playwright.test",
    "E2E Con Compra",
    process.env.E2E_STUDENT_PASSWORD
  );
  const { error: purchaseError } = await admin.from("purchases").upsert(
    {
      user_id: results.student.id,
      course_id: MAIN_COURSE_ID,
      organization_id: organizationId,
      amount_paid: 0,
      payment_method: "stripe",
      external_reference: `e2e-seed-${results.student.id}`,
    },
    { onConflict: "user_id,course_id" }
  );
  if (purchaseError) throw purchaseError;

  const { error: studentMembershipError } = await admin
    .from("organization_students")
    .upsert(
      {
        organization_id: organizationId,
        user_id: results.student.id,
        status: "active",
        joined_via: "purchase",
      },
      { onConflict: "organization_id,user_id" }
    );
  if (studentMembershipError) throw studentMembershipError;

  results.noAccess = await upsertTestUser(
    "e2e-student-sin-compra@playwright.test",
    "E2E Sin Compra",
    process.env.E2E_NOACCESS_PASSWORD
  );

  if (!process.env.CI) {
    const envFile = [
      `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`,
      `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`,
      `E2E_ADMIN_EMAIL=${results.admin.email}`,
      `E2E_ADMIN_PASSWORD=${results.admin.password}`,
      `E2E_STUDENT_EMAIL=${results.student.email}`,
      `E2E_STUDENT_PASSWORD=${results.student.password}`,
      `E2E_NOACCESS_EMAIL=${results.noAccess.email}`,
      `E2E_NOACCESS_PASSWORD=${results.noAccess.password}`,
      "",
    ].join("\n");
    await writeFile(".env.e2e.local", envFile, { mode: 0o600 });
    console.log("Cuentas y .env.e2e.local listos para Playwright.");
  } else {
    console.log("Cuentas E2E listas; CI conserva sus variables inyectadas.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
