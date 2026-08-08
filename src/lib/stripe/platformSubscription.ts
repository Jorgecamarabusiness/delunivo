import { stripe } from "./client";

const PLATFORM_SUBSCRIPTION_PRICE_CENTS = 2000; // 20€/mes

/**
 * Checkout de la suscripción de PLATAFORMA (20€/mes que cada organización le
 * paga a Aularia) — siempre en la cuenta principal de Stripe, nunca en una
 * cuenta conectada. Compartido entre el alta de empresa (index) y
 * /admin/facturacion (reactivar tras un pago fallido/cancelado).
 */
export async function createPlatformSubscriptionCheckoutUrl(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: "Suscripción Aularia" },
          unit_amount: PLATFORM_SUBSCRIPTION_PRICE_CENTS,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/admin/facturacion?checkout=success`,
    cancel_url: `${siteUrl}/admin/facturacion?checkout=cancelled`,
    client_reference_id: userId,
    metadata: { organization_id: organizationId },
  });

  return session.url;
}
