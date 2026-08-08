// Crea (o resetea) una segunda organización de prueba con su propio admin y
// un curso propio, para verificar a mano el aislamiento multi-tenant: que un
// admin de una organización no vea ni pueda editar datos de otra.
// Es idempotente: se puede volver a correr sin duplicar nada.
//
// Uso: node --env-file=.env.local scripts/seed-second-test-org.mjs
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Ejecuta con --env-file=.env.local"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_SLUG = "cliente-prueba";
const ORG_NAME = "Cliente de Prueba";
const ADMIN_EMAIL = "admin@cliente-prueba.test";

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
  const testAdmin = await upsertTestUser(ADMIN_EMAIL, "Admin Cliente de Prueba");

  let { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (!org) {
    const { data: newOrg, error: orgError } = await admin
      .from("organizations")
      .insert({ name: ORG_NAME, slug: ORG_SLUG, owner_id: testAdmin.id })
      .select("id")
      .single();
    if (orgError) throw orgError;
    org = newOrg;

    const { error: billingError } = await admin
      .from("organization_billing")
      .insert({ organization_id: org.id, platform_subscription_status: "active" });
    if (billingError) throw billingError;
  }

  const { error: membershipError } = await admin.from("organization_admins").upsert(
    { organization_id: org.id, user_id: testAdmin.id, role: "owner" },
    { onConflict: "organization_id,user_id" }
  );
  if (membershipError) throw membershipError;

  let { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!course) {
    const { data: newCourse, error: courseError } = await admin
      .from("courses")
      .insert({
        organization_id: org.id,
        title: "Curso de aislamiento (prueba)",
        description: "Curso de prueba para verificar aislamiento multi-tenant.",
        long_description:
          "Este curso solo existe para comprobar que un admin de otra organización no puede verlo ni editarlo.",
        price: 9.99,
        learning_points: ["Verificar aislamiento entre organizaciones"],
        status: "draft",
      })
      .select("id")
      .single();
    if (courseError) throw courseError;
    course = newCourse;
  }

  console.log("\nOrganización de prueba lista:");
  console.log(`  organization_id: ${org.id}`);
  console.log(`  slug: ${ORG_SLUG}`);
  console.log(`  course_id: ${course.id}`);
  console.log("\nCredenciales del admin (guárdalas, no se vuelven a mostrar si ya existía):");
  console.log(`  email: ${testAdmin.email}`);
  console.log(`  password: ${testAdmin.password}`);
  console.log(testAdmin.created ? "\n(cuenta creada nueva)" : "\n(cuenta ya existía, se le reseteó la contraseña)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
