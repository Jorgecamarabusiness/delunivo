import crypto from "node:crypto";
import { adminClient } from "./helpers";

/** Mismo algoritmo que src/lib/invitations/token.ts::hashInvitationToken — se
 * duplica aquí (una línea) para no depender de resolver el alias "@/" desde
 * los tests de Playwright. */
export function hashInvitationTokenForTest(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Organizaciones "de usar y tirar" para los specs de la Fase 10: cada spec
 * crea la suya en beforeAll y la borra en afterAll con el cliente admin
 * (service role) — no dependen de cuentas fijas ni de Secrets nuevos en CI
 * (ya existen NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY para el
 * seed de e2e-users). Evita compartir estado mutable entre specs que corren
 * en paralelo (ver playwright.config.ts, fullyParallel: true).
 */

function randomSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

export type TestOrg = {
  orgId: string;
  slug: string;
  prefix: string;
  owner: { id: string; email: string; password: string };
  /** IDs de usuarios auth adicionales creados durante el test (alumnos invitados, etc.) — se borran en destroyTestOrg. */
  extraUserIds: string[];
};

export async function createTestOrg(opts?: {
  namePrefix?: string;
  billingStatus?: "trialing" | "active" | "past_due" | "canceled";
}): Promise<TestOrg> {
  const admin = adminClient();
  const suffix = randomSuffix();
  const slug = `e2e-${suffix}`;
  const email = `e2e-owner-${suffix}@playwright.test`;
  const password = `Test-${suffix}-Aa1`;
  const name = `${opts?.namePrefix ?? "Org E2E"} ${suffix}`;

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Owner E2E" },
  });
  if (userError || !created.user) {
    throw userError ?? new Error("No se pudo crear el usuario owner de prueba.");
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name, slug, owner_id: created.user.id })
    .select("id")
    .single();
  if (orgError || !org) {
    throw orgError ?? new Error("No se pudo crear la organización de prueba.");
  }

  const { error: billingError } = await admin.from("organization_billing").insert({
    organization_id: org.id,
    platform_subscription_status: opts?.billingStatus ?? "active",
  });
  if (billingError) throw billingError;

  const { error: membershipError } = await admin.from("organization_admins").insert({
    organization_id: org.id,
    user_id: created.user.id,
    role: "owner",
  });
  if (membershipError) throw membershipError;

  return {
    orgId: org.id,
    slug,
    prefix: `/o/${slug}`,
    owner: { id: created.user.id, email, password },
    extraUserIds: [],
  };
}

export async function destroyTestOrg(testOrg: TestOrg): Promise<void> {
  const admin = adminClient();
  const orgId = testOrg.orgId;

  const { data: courses } = await admin
    .from("courses")
    .select("id")
    .eq("organization_id", orgId);
  const courseIds = (courses ?? []).map((c) => c.id);

  if (courseIds.length > 0) {
    await admin.from("lessons").delete().in("course_id", courseIds);
    await admin.from("sections").delete().in("course_id", courseIds);
    await admin.from("purchases").delete().in("course_id", courseIds);
    await admin.from("courses").delete().in("id", courseIds);
  }

  await admin.from("invitations").delete().eq("organization_id", orgId);
  await admin.from("organization_students").delete().eq("organization_id", orgId);
  await admin.from("organization_admins").delete().eq("organization_id", orgId);
  await admin.from("organization_integrations").delete().eq("organization_id", orgId);
  await admin.from("organization_billing").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);

  const userIds = [testOrg.owner.id, ...testOrg.extraUserIds];
  for (const userId of userIds) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}
