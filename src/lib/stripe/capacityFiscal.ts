import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";
import { assertFiscalCustomer, assertPilotTaxRate, FISCAL_POLICY_VERSION, fiscalPolicyRequired, validateFiscalDomicile, type FiscalDomicile } from "@/lib/billing/fiscalPolicy";
import { OFFER_VERSION } from "@/lib/billing/catalog";
import type { CheckoutAttempt } from "./checkoutAttempts";

async function customerBinding(organizationId: string) {
  const result = await createAdminClient().from("organization_billing")
    .select("platform_stripe_customer_id").eq("organization_id", organizationId).single();
  if (result.error || !result.data) throw new Error("No se pudo verificar la facturación de la escuela.");
  return result.data.platform_stripe_customer_id as string | null;
}

async function assertExclusiveBinding(customerId: string, organizationId: string) {
  const other = await createAdminClient().from("organization_billing")
    .select("organization_id").eq("platform_stripe_customer_id", customerId)
    .neq("organization_id", organizationId).limit(1);
  if (other.error || other.data?.length) throw new Error("El cliente de facturación no tiene una atribución segura.");
}

/** Stripe owns the fiscal domicile; Supabase keeps only its existing Customer ID. */
export async function prepareCapacityFiscalCustomer(organizationId: string, domicile: FiscalDomicile) {
  domicile = validateFiscalDomicile({name:domicile.name,line1:domicile.address.line1,city:domicile.address.city,
    postalCode:domicile.address.postal_code,country:domicile.address.country,accepted:"yes"});
  let customerId = await customerBinding(organizationId);
  const metadata = { organization_id: organizationId, fiscal_policy_version: FISCAL_POLICY_VERSION };
  if (!customerId) {
    const created = await stripe.customers.create({ ...domicile, metadata }, {
      idempotencyKey: `delunivo-fiscal-customer-${organizationId}-${FISCAL_POLICY_VERSION}`,
    });
    const saved = await createAdminClient().from("organization_billing")
      .update({ platform_stripe_customer_id: created.id })
      .eq("organization_id", organizationId).is("platform_stripe_customer_id", null)
      .select("platform_stripe_customer_id").maybeSingle();
    if (saved.error) throw new Error("No se pudo guardar el cliente fiscal. Vuelve a intentarlo antes de pagar.");
    // A concurrent owner request may have persisted the binding first.
    customerId = saved.data?.platform_stripe_customer_id ?? await customerBinding(organizationId);
  }
  if (!customerId) throw new Error("El cliente fiscal está pendiente de confirmar.");
  await assertExclusiveBinding(customerId, organizationId);
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || (customer.metadata.organization_id && customer.metadata.organization_id !== organizationId) || customer.tax_exempt !== "none")
    throw new Error("El cliente fiscal requiere conciliación antes de contratar en este piloto.");
  await stripe.customers.update(customerId, { ...domicile, metadata });
  const confirmed = await stripe.customers.retrieve(customerId);
  assertFiscalCustomer(confirmed, organizationId);
  return customerId;
}

export async function assertCapacityFiscalCustomer(organizationId: string) {
  const id = await customerBinding(organizationId);
  if (!fiscalPolicyRequired()) return id;
  if (process.env.PLATFORM_TAX_LIVE_APPROVED !== OFFER_VERSION || !process.env.PLATFORM_TAX_RATE_ID)
    throw new Error("La configuración fiscal del piloto todavía no está aprobada.");
  assertPilotTaxRate(await stripe.taxRates.retrieve(process.env.PLATFORM_TAX_RATE_ID));
  if (!id) throw new Error("Confirma el domicilio fiscal antes de abrir el pago.");
  await assertExclusiveBinding(id, organizationId);
  assertFiscalCustomer(await stripe.customers.retrieve(id), organizationId);
  return id;
}

/** Applies at the shared creation/reuse boundary, including owner recovery. */
export async function assertCapacityFiscalAttempt(attempt: CheckoutAttempt) {
  if (!attempt.stripe_params.metadata?.capacity_operation_id || !fiscalPolicyRequired()) return;
  try {
    const id = await assertCapacityFiscalCustomer(attempt.organization_id);
    const params = attempt.stripe_params;
    if (params.customer !== id || params.metadata?.fiscal_policy_version !== FISCAL_POLICY_VERSION ||
      params.customer_update?.address !== "never" || params.customer_update?.name !== "never" ||
      params.tax_id_collection?.enabled || params.automatic_tax?.enabled ||
      params.line_items?.length !== 1 ||
      params.line_items.some(line => line.tax_rates?.length !== 1 || line.tax_rates[0] !== process.env.PLATFORM_TAX_RATE_ID) ||
      (params.mode === "subscription" && (params.subscription_data?.default_tax_rates?.length !== 1 || params.subscription_data.default_tax_rates[0] !== process.env.PLATFORM_TAX_RATE_ID)))
      throw new Error("Esta sesión de pago no pertenece a la política fiscal vigente. Ciérrala y prepara una nueva oferta.");
  } catch (error) {
    // Do not leave a known unsafe open Checkout usable after a policy change.
    if (attempt.stripe_session_id) {
      let session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
      if (session.status === "open") {
        try { session = await stripe.checkout.sessions.expire(session.id); }
        catch { session = await stripe.checkout.sessions.retrieve(session.id); }
      }
      if (session.status === "expired") {
        const saved = await createAdminClient().from("stripe_checkout_attempts")
          .update({ status: "expired" }).eq("id", attempt.id).in("status", ["creating", "open"]);
        if (saved.error) throw new Error("El cierre fiscal del pago está pendiente de conciliación.");
      }
    }
    throw error;
  }
}
