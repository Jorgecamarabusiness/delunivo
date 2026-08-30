import { test, expect } from "@playwright/test";
import { login, adminClient, authenticatedClientFromPage } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

// Los 4 estados de organization_billing.platform_subscription_status y el
// bloqueo de AdminBillingGate (src/components/layout/AdminBillingGate.tsx):
// canceled bloquea todo /admin salvo /admin/facturacion; past_due solo avisa
// (grace period); trialing/active no bloquean nada. Serial porque cada test
// muta el estado de la MISMA organización efímera.

test.describe.configure({ mode: "serial" });

let org: TestOrg;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Facturación", billingStatus: "active" });
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

async function setBillingStatus(orgId: string, status: string) {
  const admin = adminClient();
  const { error } = await admin
    .from("organization_billing")
    .update({ platform_subscription_status: status })
    .eq("organization_id", orgId);
  if (error) throw error;
}

async function setCommercialAccess(
  orgId: string,
  accessMode: "standard" | "complimentary" | "trial",
  accessExpiresAt: string | null
) {
  const { error } = await adminClient()
    .from("organization_billing")
    .update({ access_mode: accessMode, access_expires_at: accessExpiresAt })
    .eq("organization_id", orgId);
  if (error) throw error;
}

test("'active' no bloquea /admin y muestra 'Gestionar suscripción'", async ({ page }) => {
  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin");
  await expect(page.getByText("Cuenta suspendida")).toHaveCount(0);

  await page.goto("/admin/facturacion");
  await expect(page.getByText("Activa")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar suscripción" })).toBeVisible();
});

test("'past_due' muestra un aviso pero no bloquea el panel", async ({ page }) => {
  await setBillingStatus(org.orgId, "past_due");
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin");
  await expect(page.getByText("Cuenta suspendida")).toHaveCount(0);
  await expect(page.getByText("Hay un problema con tu último pago a Delunivo.")).toBeVisible();

  await page.goto("/admin/facturacion");
  await expect(page.getByText("Pago pendiente")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar suscripción" })).toBeVisible();
});

test("'canceled' bloquea todo /admin salvo /admin/facturacion", async ({ page }) => {
  await setBillingStatus(org.orgId, "canceled");
  await setCommercialAccess(org.orgId, "standard", null);
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toBeVisible();
  await expect(page.getByText("Alumnos y administradores")).toHaveCount(0);

  await page.goto("/admin/facturacion");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivar suscripción" })).toBeVisible();

  const ownerDataClient = await authenticatedClientFromPage(page);
  const { data: hasAccess } = await ownerDataClient.rpc("has_org_platform_access", {
    org_id: org.orgId,
  });
  expect(hasAccess).toBe(false);

  const { error: directWriteError } = await ownerDataClient
    .from("organizations")
    .update({ name: org.slug })
    .eq("id", org.orgId)
    .select("id")
    .single();
  expect(directWriteError).not.toBeNull();
});

test("volver a 'active' desbloquea el panel de nuevo", async ({ page }) => {
  await setBillingStatus(org.orgId, "active");
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);
  await expect(page.getByText("Alumnos y administradores")).toBeVisible();
});

test("una invitación gratuita mantiene el panel abierto sin cobrar", async ({ page }) => {
  await setBillingStatus(org.orgId, "canceled");
  await setCommercialAccess(org.orgId, "complimentary", null);
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);

  await page.goto("/admin/facturacion");
  await expect(page.getByText("Acceso gratuito por invitación")).toBeVisible();

  const ownerDataClient = await authenticatedClientFromPage(page);
  const { data: hasAccess } = await ownerDataClient.rpc("has_org_platform_access", {
    org_id: org.orgId,
  });
  expect(hasAccess).toBe(true);

  const { data: organization } = await adminClient()
    .from("organizations")
    .select("name")
    .eq("id", org.orgId)
    .single();
  const { error: directWriteError } = await ownerDataClient
    .from("organizations")
    .update({ name: organization!.name })
    .eq("id", org.orgId)
    .select("id")
    .single();
  expect(directWriteError).toBeNull();
});

test("una prueba vigente mantiene el panel abierto hasta su fecha final", async ({ page }) => {
  await setCommercialAccess(
    org.orgId,
    "trial",
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  );
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);

  await page.goto("/admin/facturacion");
  await expect(page.getByText("En periodo de prueba")).toBeVisible();
});

test("un propietario elige qué empresa gestionar aunque otra tenga acceso", async ({
  page,
}) => {
  const admin = adminClient();
  const suffix = Date.now();
  const secondName = `Empresa cancelada ${suffix}`;
  const { data: secondOrg, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: secondName,
      slug: `e2e-billing-${suffix}`,
      owner_id: org.owner.id,
    })
    .select("id")
    .single();
  if (orgError || !secondOrg) throw orgError;

  try {
    const { error: billingError } = await admin.from("organization_billing").insert({
      organization_id: secondOrg.id,
      platform_subscription_status: "canceled",
      access_mode: "standard",
    });
    if (billingError) throw billingError;
    const { error: membershipError } = await admin
      .from("organization_admins")
      .insert({
        organization_id: secondOrg.id,
        user_id: org.owner.id,
        role: "owner",
      });
    if (membershipError) throw membershipError;

    await login(page, org.owner.email, org.owner.password, org.prefix);
    await page.goto(`/admin/facturacion?empresa=${secondOrg.id}`);

    await expect(page.getByLabel("Empresa")).toHaveValue(secondOrg.id);
    await expect(
      page.locator("p").filter({ hasText: `${secondName} · Suscripción` })
    ).toBeVisible();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(
      page.locator('input[name="organizationId"]')
    ).toHaveValue(secondOrg.id);
  } finally {
    await admin
      .from("organization_admins")
      .delete()
      .eq("organization_id", secondOrg.id);
    await admin
      .from("organization_billing")
      .delete()
      .eq("organization_id", secondOrg.id);
    await admin.from("organizations").delete().eq("id", secondOrg.id);
  }
});
