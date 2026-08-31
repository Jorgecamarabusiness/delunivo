import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  commercialTermsIdempotencyKey,
  subscriptionMatchesCommercialTerms,
} from "./subscriptionTerms.ts";

function subscription(
  values: Partial<Stripe.Subscription>
): Stripe.Subscription {
  return {
    discounts: [],
    status: "active",
    trial_end: null,
    ...values,
  } as Stripe.Subscription;
}

describe("commercial subscription synchronization", () => {
  it("recognizes an expanded Stripe coupon and an exact trial end", () => {
    const trialEndsAt = new Date("2026-10-01T23:59:59.000Z");
    const value = subscription({
      status: "trialing",
      trial_end: Math.floor(trialEndsAt.getTime() / 1000),
      discounts: [
        {
          source: { coupon: "coupon_123", type: "coupon" },
        } as Stripe.Discount,
      ],
    });

    assert.equal(
      subscriptionMatchesCommercialTerms(value, {
        couponId: "coupon_123",
        trialEndsAt,
        shouldEndCurrentTrial: false,
      }),
      true
    );
  });

  it("rejects a different discount and accepts a trial that has ended", () => {
    const value = subscription({ discounts: [], status: "active" });
    assert.equal(
      subscriptionMatchesCommercialTerms(value, {
        couponId: "coupon_other",
        trialEndsAt: null,
        shouldEndCurrentTrial: false,
      }),
      false
    );
    assert.equal(
      subscriptionMatchesCommercialTerms(value, {
        couponId: null,
        trialEndsAt: null,
        shouldEndCurrentTrial: true,
      }),
      true
    );
  });

  it("builds the same idempotency key for the same desired state", () => {
    const expected = {
      couponId: "coupon_123",
      trialEndsAt: null,
      shouldEndCurrentTrial: false,
    };
    assert.equal(
      commercialTermsIdempotencyKey("sub_123", expected),
      commercialTermsIdempotencyKey("sub_123", expected)
    );
  });
});
