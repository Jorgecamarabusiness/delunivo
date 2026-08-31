import { createHash } from "node:crypto";
import type Stripe from "stripe";

export type ExpectedCommercialTerms = {
  couponId: string | null;
  trialEndsAt: Date | null;
  shouldEndCurrentTrial: boolean;
};

function couponIdFromDiscount(discount: string | Stripe.Discount) {
  if (typeof discount === "string") return null;
  const coupon = discount.source?.coupon;
  return typeof coupon === "string" ? coupon : coupon?.id ?? null;
}

export function subscriptionMatchesCommercialTerms(
  subscription: Stripe.Subscription,
  expected: ExpectedCommercialTerms
) {
  const couponIds = subscription.discounts
    .map(couponIdFromDiscount)
    .filter((couponId): couponId is string => Boolean(couponId));
  const couponMatches = expected.couponId
    ? couponIds.length === 1 && couponIds[0] === expected.couponId
    : subscription.discounts.length === 0;

  if (!couponMatches) return false;

  if (expected.trialEndsAt) {
    return (
      subscription.trial_end ===
      Math.floor(expected.trialEndsAt.getTime() / 1000)
    );
  }

  if (expected.shouldEndCurrentTrial) {
    return subscription.status !== "trialing";
  }

  return true;
}

export function commercialTermsIdempotencyKey(
  subscriptionId: string,
  expected: ExpectedCommercialTerms
) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        couponId: expected.couponId,
        trialEndsAt: expected.trialEndsAt?.toISOString() ?? null,
        shouldEndCurrentTrial: expected.shouldEndCurrentTrial,
      })
    )
    .digest("hex")
    .slice(0, 32);

  return `delunivo-commercial-${subscriptionId}-${fingerprint}`;
}
