import { test, expect } from "@playwright/test";
import { login, adminClient } from "./helpers";
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
  await expect(page.getByRole("button", { name: "Reactivar suscripción" })).toBeVisible();
});

test("'canceled' bloquea todo /admin salvo /admin/facturacion", async ({ page }) => {
  await setBillingStatus(org.orgId, "canceled");
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toBeVisible();
  await expect(page.getByText("Alumnos y administradores")).toHaveCount(0);

  await page.goto("/admin/facturacion");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivar suscripción" })).toBeVisible();
});

test("volver a 'active' desbloquea el panel de nuevo", async ({ page }) => {
  await setBillingStatus(org.orgId, "active");
  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Cuenta suspendida" })).toHaveCount(0);
  await expect(page.getByText("Alumnos y administradores")).toBeVisible();
});
