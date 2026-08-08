import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const organizationId = session.metadata?.organization_id;
  if (!organizationId) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("organization_billing")
    .update({
      platform_stripe_customer_id: customerId(session.customer),
      platform_subscription_id:
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null),
      platform_subscription_status: "active",
    })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

/** invoice.paid / invoice.payment_failed / customer.subscription.deleted — cambios de estado posteriores. */
export async function updatePlatformBillingStatusByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  status: BillingStatus
): Promise<void> {
  const id = customerId(customer);
  if (!id) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("organization_billing")
    .update({ platform_subscription_status: status })
    .eq("platform_stripe_customer_id", id);

  if (error) {
    throw new Error(error.message);
  }
}
