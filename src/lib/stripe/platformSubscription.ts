import "server-only";

import { PLATFORM_NAME } from "@/lib/brand";
import { hasComplimentaryAccess, isFutureDate } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";
import { createPlatformCoupon } from "./platformCoupons";
import {
  claimCheckoutAttempt,
  getCheckoutUrlForAttempt,
} from "./checkoutAttempts";

/**
 * Checkout de la suscripción que cada organización paga a Delunivo. El precio
 * y las condiciones comerciales salen de la base de datos; Stripe sigue
 * siendo la fuente de verdad del cobro real.
 */
export async function createPlatformSubscriptionCheckoutUrl(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  const [billingResult, organizationResult, settingsResult] = await Promise.all([
    admin
      .from("organization_billing")
      .select(
        "platform_stripe_customer_id, platform_subscription_id, platform_subscription_status, access_mode, access_expires_at, discount_percent, discount_duration, stripe_coupon_id"
      )
      .eq("organization_id", organizationId)
      .single(),
    admin.from("organizations").select("name").eq("id", organizationId).single(),
    admin
      .from("platform_settings")
      .select("monthly_price_cents")
      .eq("id", true)
      .single(),
  ]);

  if (
    billingResult.error ||
    organizationResult.error ||
    settingsResult.error ||
    !billingResult.data ||
    !organizationResult.data ||
    !settingsResult.data
  ) {
    throw new Error("No se pudo verificar la facturación de la empresa.");
  }

  const billing = billingResult.data;
  const organization = organizationResult.data;
  const priceCents = settingsResult.data.monthly_price_cents;
  if (!Number.isInteger(priceCents) || priceCents < 100) {
    throw new Error("El precio mensual de Delunivo no es válido.");
  }

  if (
    billing.platform_subscription_id &&
    ["trialing", "active", "past_due"].includes(
      billing.platform_subscription_status
    )
  ) {
    throw new Error(
      "Esta empresa ya tiene una suscripción de Stripe; gestiona la existente desde el portal."
    );
  }

  if (
    hasComplimentaryAccess({
      platformSubscriptionStatus: null,
      accessMode: billing.access_mode,
      accessExpiresAt: billing.access_expires_at,
    })
  ) {
    return null;
  }

  let couponId =
    billing?.discount_percent && billing.discount_percent > 0
      ? billing.stripe_coupon_id
      : null;

  if (billing?.discount_percent && billing.discount_percent > 0 && !couponId) {
    const coupon = await createPlatformCoupon({
      organizationId,
      organizationName: organization.name ?? PLATFORM_NAME,
      percentOff: billing.discount_percent,
      duration: billing.discount_duration === "forever" ? "forever" : "once",
    });
    couponId = coupon.id;
    const { error: couponUpdateError } = await admin
      .from("organization_billing")
      .update({ stripe_coupon_id: coupon.id, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    if (couponUpdateError) {
      throw new Error("No se pudo guardar el descuento antes de abrir Stripe.");
    }
  }

  const trialDays =
    billing?.access_mode === "trial" && isFutureDate(billing.access_expires_at)
      ? Math.max(
          1,
          Math.ceil(
            (new Date(billing.access_expires_at!).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

  const stripeParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: `Suscripción ${PLATFORM_NAME}` },
          unit_amount: priceCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/admin/facturacion?empresa=${organizationId}&checkout=success`,
    cancel_url: `${siteUrl}/admin/facturacion?empresa=${organizationId}&checkout=cancelled`,
    client_reference_id: userId,
    metadata: { organization_id: organizationId, user_id: userId },
    ...(billing.platform_stripe_customer_id
      ? { customer: billing.platform_stripe_customer_id }
      : {}),
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    ...(trialDays
      ? {
          subscription_data: {
            trial_period_days: trialDays,
            metadata: { organization_id: organizationId },
          },
        }
      : {}),
  } satisfies Parameters<typeof stripe.checkout.sessions.create>[0];

  const attempt = await claimCheckoutAttempt({
    checkoutKind: "platform_subscription",
    organizationId,
    userId,
    courseId: null,
    stripeAccountId: null,
    stripeParams,
    expectedAmountTotal: null,
    expectedCurrency: "eur",
  });

  return getCheckoutUrlForAttempt(attempt);
}
