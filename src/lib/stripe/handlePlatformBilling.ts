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
  session: Stripe.Checkout.Session,
  eventAt: Date
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

  const { error } = await supabase.rpc(
    "apply_platform_subscription_checkout_event",
    {
      p_organization_id: organizationId,
      p_customer_id: stripeCustomerId,
      p_subscription_id: stripeSubscriptionId,
      p_event_at: eventAt.toISOString(),
    }
  );
  if (error) throw new Error(error.message);

  await markCheckoutAttemptCompleted(attempt.id);
}

function expandableId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return expandableId(invoice.parent?.subscription_details?.subscription);
}

/**
 * invoice.paid / invoice.payment_failed / customer.subscription.deleted.
 * Exige cliente Y suscripción: un evento retrasado de una suscripción anterior
 * del mismo cliente se considera obsoleto y no puede cambiar el estado actual.
 */
export async function updatePlatformBillingStatusForSubscription(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  subscriptionId: string | null,
  status: BillingStatus,
  eventAt: Date
): Promise<string | null> {
  const id = customerId(customer);
  if (!id || !subscriptionId) return null;

  const { data, error } = await createAdminClient().rpc(
    "apply_platform_billing_status_event",
    {
      p_customer_id: id,
      p_subscription_id: subscriptionId,
      p_status: status,
      p_event_at: eventAt.toISOString(),
    }
  );
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}
