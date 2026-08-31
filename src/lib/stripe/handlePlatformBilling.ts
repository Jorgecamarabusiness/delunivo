import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { markCheckoutAttemptCompleted } from "./checkoutAttempts";
import { validatePlatformCheckoutSession } from "./checkoutValidation";

type BillingStatus = "active" | "past_due" | "canceled";

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/** checkout.session.completed con mode:"subscription" — primer pago de la suscripción de plataforma. */
export async function handlePlatformSubscriptionCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const supabase = createAdminClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("stripe_checkout_attempts")
    .select(
      "id, checkout_kind, organization_id, user_id, expected_currency, stripe_account_id"
    )
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (attemptError || !attempt || attempt.stripe_account_id !== null) {
    throw new Error("No existe un intento de suscripción válido para esta sesión.");
  }

  const validationError = validatePlatformCheckoutSession({ session, attempt });
  if (validationError) throw new Error(validationError);

  const organizationId = attempt.organization_id;
  const stripeCustomerId = customerId(session.customer);
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!organizationId || !stripeCustomerId || !stripeSubscriptionId) {
    throw new Error("Stripe no devolvió todos los datos de la suscripción.");
  }

  const { data, error } = await supabase
    .from("organization_billing")
    .update({
      platform_stripe_customer_id: stripeCustomerId,
      platform_subscription_id: stripeSubscriptionId,
      platform_subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .select("organization_id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se encontró la facturación de la empresa.");
  }

  await markCheckoutAttemptCompleted(attempt.id);
}

/** invoice.paid / invoice.payment_failed / customer.subscription.deleted — cambios de estado posteriores. */
export async function updatePlatformBillingStatusByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  status: BillingStatus
): Promise<void> {
  const id = customerId(customer);
  if (!id) throw new Error("Stripe no devolvió el cliente de la suscripción.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organization_billing")
    .update({
      platform_subscription_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("platform_stripe_customer_id", id)
    .select("organization_id");

  if (error || data?.length !== 1) {
    throw new Error(
      error?.message ?? "No se encontró una única empresa para el cliente de Stripe."
    );
  }
}
