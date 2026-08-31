import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import Stripe from "stripe";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";
import { ACCOUNTS, adminClient, login } from "./helpers";

test.describe.configure({ mode: "serial" });

let superAdminOrg: TestOrg;
let supportTargetOrg: TestOrg;
let referredOrg: TestOrg;

test.beforeAll(async () => {
  superAdminOrg = await createTestOrg({ namePrefix: "Control Delunivo" });
  supportTargetOrg = await createTestOrg({ namePrefix: "Soporte Run as" });
  referredOrg = await createTestOrg({
    namePrefix: "Empresa referida",
    billingStatus: "canceled",
  });
  const { error } = await adminClient()
    .from("profiles")
    .update({ is_super_admin: true })
    .eq("id", superAdminOrg.owner.id);
  if (error) throw error;
});

test.afterAll(async () => {
  await destroyTestOrg(referredOrg);
  await destroyTestOrg(supportTargetOrg);
  await destroyTestOrg(superAdminOrg);
});

test("afiliados aplica bienvenida, pago real, baja y tope excepcional sin apilar", async () => {
  const admin = adminClient();
  const code = crypto.randomBytes(18).toString("base64url");
  const { data: codeRow, error: codeError } = await admin
    .from("organization_referral_codes")
    .insert({
      organization_id: superAdminOrg.orgId,
      code,
      created_by: superAdminOrg.owner.id,
    })
    .select("id")
    .single();
  if (codeError || !codeRow) throw codeError;

  const { error: attachError } = await admin.rpc("attach_organization_referral", {
    p_code: code,
    p_referred_organization_id: referredOrg.orgId,
    p_referred_owner_id: referredOrg.owner.id,
  });
  if (attachError) throw attachError;

  async function applyPaid(sequence: number, amountPaid: number) {
    const eventId = `evt_e2e_affiliate_${referredOrg.orgId}_${sequence}`;
    const { error: claimError } = await admin.rpc(
      "claim_stripe_platform_webhook_event",
      { p_event_id: eventId, p_event_type: "invoice.paid" }
    );
    if (claimError) throw claimError;
    const { error: applyError } = await admin.rpc(
      "apply_stripe_affiliate_billing_event",
      {
        p_event_id: eventId,
        p_organization_id: referredOrg.orgId,
        p_event_kind: "invoice_paid",
        p_event_at: new Date(Date.now() + sequence * 1000).toISOString(),
        p_amount_paid: amountPaid,
      }
    );
    if (applyError) throw applyError;
  }

  await applyPaid(0, 0);
  let { data: referral } = await admin
    .from("organization_referrals")
    .select("status")
    .eq("referred_organization_id", referredOrg.orgId)
    .single();
  expect(referral?.status).toBe("pending");

  for (let payment = 1; payment <= 3; payment += 1) {
    await applyPaid(payment, 2_700);
  }

  const [{ data: referrerBilling }, { data: referredBilling }] = await Promise.all([
    admin
      .from("organization_billing")
      .select("effective_discount_percent")
      .eq("organization_id", superAdminOrg.orgId)
      .single(),
    admin
      .from("organization_billing")
      .select("effective_discount_percent, referral_welcome_remaining_payments")
      .eq("organization_id", referredOrg.orgId)
      .single(),
  ]);
  expect(referrerBilling?.effective_discount_percent).toBe(10);
  expect(referredBilling?.referral_welcome_remaining_payments).toBe(0);
  expect(referredBilling?.effective_discount_percent).toBe(0);

  const { error: exceptionalError } = await admin
    .from("organization_billing")
    .update({
      discount_percent: 60,
      discount_duration: "forever",
      affiliate_discount_cap_percent: 70,
    })
    .eq("organization_id", superAdminOrg.orgId);
  if (exceptionalError) throw exceptionalError;
  await admin.rpc("refresh_organization_effective_discount", {
    p_organization_id: superAdminOrg.orgId,
  });
  const { data: exceptionalBilling } = await admin
    .from("organization_billing")
    .select("effective_discount_percent")
    .eq("organization_id", superAdminOrg.orgId)
    .single();
  expect(exceptionalBilling?.effective_discount_percent).toBe(70);

  const failedEventId = `evt_e2e_affiliate_failed_${referredOrg.orgId}`;
  await admin.rpc("claim_stripe_platform_webhook_event", {
    p_event_id: failedEventId,
    p_event_type: "invoice.payment_failed",
  });
  await admin.rpc("apply_stripe_affiliate_billing_event", {
    p_event_id: failedEventId,
    p_organization_id: referredOrg.orgId,
    p_event_kind: "payment_failed",
    p_event_at: new Date(Date.now() + 10_000).toISOString(),
    p_amount_paid: 0,
  });
  ({ data: referral } = await admin
    .from("organization_referrals")
    .select("status")
    .eq("referred_organization_id", referredOrg.orgId)
    .single());
  expect(referral?.status).toBe("inactive");
});

test("el webhook ignora otra suscripción y ordena eventos de la vigente", async ({
  request,
}) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Falta STRIPE_WEBHOOK_SECRET para el E2E.");
  const webhookSecret = secret;

  const customerId = `cus_e2e_${superAdminOrg.orgId}`;
  const currentSubscriptionId = `sub_e2e_current_${superAdminOrg.orgId}`;
  const staleSubscriptionId = `sub_e2e_stale_${superAdminOrg.orgId}`;
  const admin = adminClient();
  const { error: setupError } = await admin
    .from("organization_billing")
    .update({
      platform_stripe_customer_id: customerId,
      platform_subscription_id: currentSubscriptionId,
      platform_subscription_status: "active",
    })
    .eq("organization_id", superAdminOrg.orgId);
  if (setupError) throw setupError;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
  const livemode = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));

  async function sendEvent(type: string, object: Record<string, unknown>) {
    const id = `evt_e2e_stale_${superAdminOrg.orgId}_${type.replaceAll(".", "_")}`;
    const payload = JSON.stringify({
      id,
      object: "event",
      api_version: null,
      created: Math.floor(Date.now() / 1000),
      data: { object },
      livemode,
      pending_webhooks: 1,
      request: null,
      type,
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
    const response = await request.post("/api/webhooks/stripe", {
      data: payload,
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
    });
    expect(response.status()).toBe(200);
  }

  await sendEvent("invoice.paid", {
    id: `in_stale_${superAdminOrg.orgId}`,
    object: "invoice",
    customer: customerId,
    amount_paid: 3_000,
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        metadata: null,
        subscription: staleSubscriptionId,
      },
    },
  });
  await sendEvent("customer.subscription.deleted", {
    id: staleSubscriptionId,
    object: "subscription",
    customer: customerId,
  });

  const { data: billing } = await admin
    .from("organization_billing")
    .select("platform_subscription_id, platform_subscription_status")
    .eq("organization_id", superAdminOrg.orgId)
    .single();
  expect(billing?.platform_subscription_id).toBe(currentSubscriptionId);
  expect(billing?.platform_subscription_status).toBe("active");

  const paidAt = new Date(Date.now() + 10_000).toISOString();
  const staleFailureAt = new Date(Date.now()).toISOString();
  const { data: paidOrganization, error: paidError } = await admin.rpc(
    "apply_platform_billing_status_event",
    {
      p_customer_id: customerId,
      p_subscription_id: currentSubscriptionId,
      p_status: "active",
      p_event_at: paidAt,
    }
  );
  if (paidError) throw paidError;
  expect(paidOrganization).toBe(superAdminOrg.orgId);

  const { data: delayedCheckout, error: delayedCheckoutError } = await admin.rpc(
    "apply_platform_subscription_checkout_event",
    {
      p_organization_id: superAdminOrg.orgId,
      p_customer_id: customerId,
      p_subscription_id: currentSubscriptionId,
      p_event_at: new Date(Date.now() - 10_000).toISOString(),
    }
  );
  if (delayedCheckoutError) throw delayedCheckoutError;
  expect(delayedCheckout).toBe(false);

  const { data: staleOrganization, error: staleError } = await admin.rpc(
    "apply_platform_billing_status_event",
    {
      p_customer_id: customerId,
      p_subscription_id: currentSubscriptionId,
      p_status: "past_due",
      p_event_at: staleFailureAt,
    }
  );
  if (staleError) throw staleError;
  expect(staleOrganization).toBeNull();

  const { data: orderedBilling } = await admin
    .from("organization_billing")
    .select("platform_subscription_status, platform_billing_last_event_at")
    .eq("organization_id", superAdminOrg.orgId)
    .single();
  expect(orderedBilling?.platform_subscription_status).toBe("active");
  expect(new Date(orderedBilling!.platform_billing_last_event_at).getTime()).toBe(
    new Date(paidAt).getTime()
  );
});

test("el superadministrador controla precio, empresas y correos desde una sola página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(
    page,
    superAdminOrg.owner.email,
    superAdminOrg.owner.password,
    superAdminOrg.prefix
  );
  await page.goto("/admin/plataforma");

  await expect(page.getByRole("heading", { name: "Control de Delunivo" })).toBeVisible();
  await expect(page.getByLabel("Precio mensual")).toHaveValue("30.00");
  await expect(page.getByRole("heading", { name: "Empresas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Correos de prueba" })).toBeVisible();
  await expect(page.getByText(/Envío desactivado/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Control Delunivo" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Control de Delunivo" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);

  await page.goto(superAdminOrg.prefix);
  const moreOptions = page.locator('summary[aria-label="Más opciones"]');
  await expect(moreOptions).toBeVisible();
  await moreOptions.click();
  await expect(page.getByRole("link", { name: "Ir a Delunivo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});

test("rechaza guardar condiciones cargadas antes de otro cambio", async ({ page }) => {
  await login(
    page,
    superAdminOrg.owner.email,
    superAdminOrg.owner.password,
    superAdminOrg.prefix
  );
  await page.goto("/admin/plataforma");

  const company = page
    .locator("details")
    .filter({ hasText: `/o/${superAdminOrg.slug}` });
  await company.locator("summary").click();
  await expect(company.getByRole("button", { name: "Guardar condiciones" })).toBeVisible();

  const { error } = await adminClient()
    .from("organization_billing")
    .update({
      commercial_note: "Cambio concurrente E2E",
      updated_at: new Date(Date.now() + 2_000).toISOString(),
    })
    .eq("organization_id", superAdminOrg.orgId);
  if (error) throw error;

  await company.getByLabel("Nota interna").fill("Cambio desde una vista obsoleta");
  await company.getByRole("button", { name: "Guardar condiciones" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Confirmar cambios" }).click();
  await expect(dialog).toContainText("Otra persona ha actualizado esta empresa");
});

test("Run as abre una sesión auditada, bloquea facturación y restaura al superadmin", async ({
  page,
}) => {
  await login(
    page,
    superAdminOrg.owner.email,
    superAdminOrg.owner.password,
    superAdminOrg.prefix
  );
  await page.goto("/admin/plataforma");

  const company = page
    .locator("details")
    .filter({ hasText: `/o/${supportTargetOrg.slug}` });
  await company.locator("summary").click();
  await company.getByRole("button", { name: "Run as" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Motivo del soporte").fill("Reproducir error E2E del editor");
  await dialog.getByRole("button", { name: "Iniciar Run as" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(/Run as: estás actuando como/)).toBeVisible();

  await page.goto(`/admin/facturacion?empresa=${supportTargetOrg.orgId}`);
  await page.getByRole("button", { name: "Crear mi enlace" }).click();
  await expect(page.getByText(/acción sensible está bloqueada durante Run as/)).toBeVisible();

  await page.getByRole("button", { name: "Salir de Run as" }).click();
  await expect(page).toHaveURL(/\/admin\/plataforma/);
  await expect(page.getByText(/Run as: estás actuando como/)).toHaveCount(0);

  const { data: audit } = await adminClient()
    .from("support_impersonation_sessions")
    .select("status, target_auth_session_id, reason")
    .eq("target_user_id", supportTargetOrg.owner.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  expect(audit?.status).toBe("ended");
  expect(audit?.target_auth_session_id).toBeTruthy();
  expect(audit?.reason).toBe("Reproducir error E2E del editor");
});

test("Run as restaura al superadmin si caduca aunque el marcador sea manipulado", async ({
  page,
}) => {
  await login(
    page,
    superAdminOrg.owner.email,
    superAdminOrg.owner.password,
    superAdminOrg.prefix
  );
  await page.goto("/admin/plataforma");

  const company = page
    .locator("details")
    .filter({ hasText: `/o/${supportTargetOrg.slug}` });
  await company.locator("summary").click();
  await company.getByRole("button", { name: "Run as" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Motivo del soporte").fill("Validar caducidad segura E2E");
  await dialog.getByRole("button", { name: "Iniciar Run as" }).click();
  await expect(page.getByText(/Run as: estás actuando como/)).toBeVisible();

  const admin = adminClient();
  const { data: audit, error: auditError } = await admin
    .from("support_impersonation_sessions")
    .select("id")
    .eq("actor_user_id", superAdminOrg.owner.id)
    .eq("status", "active")
    .single();
  if (auditError || !audit) throw auditError;

  const now = Date.now();
  const { error: expiryError } = await admin
    .from("support_impersonation_sessions")
    .update({
      started_at: new Date(now - 16 * 60_000).toISOString(),
      expires_at: new Date(now - 60_000).toISOString(),
    })
    .eq("id", audit.id);
  if (expiryError) throw expiryError;

  const marker = (await page.context().cookies()).find(
    (cookie) => cookie.name === "delunivo_run_as"
  );
  expect(marker).toBeTruthy();
  await page.context().addCookies([{ ...marker!, value: "marker-manipulado" }]);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/plataforma\?runAs=ended/);
  await expect(page.getByText(/Run as: estás actuando como/)).toHaveCount(0);

  const { data: closed } = await admin
    .from("support_impersonation_sessions")
    .select("status")
    .eq("id", audit.id)
    .single();
  expect(closed?.status).toBe("expired");
});

test("un administrador de empresa no ve ni puede usar el control de plataforma", async ({
  page,
}) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto("/admin/plataforma");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByLabel("Precio mensual")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Control Delunivo" })).toHaveCount(0);
});
