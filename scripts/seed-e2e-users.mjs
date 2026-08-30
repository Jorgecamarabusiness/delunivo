// Crea (o resetea la contraseña de) las 3 cuentas fijas que usan los tests de
// Playwright en e2e/. Es idempotente: se puede volver a correr sin duplicar nada.
//
// Uso: node --env-file=.env.local scripts/seed-e2e-users.mjs
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const MAIN_COURSE_ID = "11111111-1111-1111-1111-111111111111";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Ejecuta con --env-file=.env.local"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function upsertTestUser(email, name) {
  const password = crypto.randomBytes(12).toString("hex");

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

  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("organization_id")
    .eq("id", MAIN_COURSE_ID)
    .single();
  if (courseError || !course) {
    throw new Error(
      `No se encontró el curso ${MAIN_COURSE_ID} o le falta organization_id. ` +
        "¿Se aplicó la migración multi-tenant (Fase 1) en este proyecto de Supabase?"
    );
  }
  const organizationId = course.organization_id;

  results.admin = await upsertTestUser("e2e-admin@playwright.test", "E2E Admin");
  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_super_admin: false })
    .eq("id", results.admin.id);
  if (profileError) throw profileError;

  const { error: adminMembershipError } = await admin
    .from("organization_admins")
    .upsert(
      { organization_id: organizationId, user_id: results.admin.id, role: "admin" },
      { onConflict: "organization_id,user_id" }
    );
  if (adminMembershipError) throw adminMembershipError;

  results.student = await upsertTestUser("e2e-student-con-compra@playwright.test", "E2E Con Compra");
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

  results.noAccess = await upsertTestUser("e2e-student-sin-compra@playwright.test", "E2E Sin Compra");

  console.log("\nCuentas de prueba listas. Guarda esto en tu gestor de contraseñas");
  console.log("y en los Secrets de GitHub (Settings → Secrets and variables → Actions):\n");

  for (const [key, envPrefix] of [
    ["admin", "E2E_ADMIN"],
    ["student", "E2E_STUDENT"],
    ["noAccess", "E2E_NOACCESS"],
  ]) {
    console.log(`${envPrefix}_EMAIL=${results[key].email}`);
    console.log(`${envPrefix}_PASSWORD=${results[key].password}`);
  }
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
