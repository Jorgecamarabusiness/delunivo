import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveBillingStatus } from "./access.ts";

describe("effective platform billing access", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("keeps a complimentary company active without Stripe", () => {
    assert.equal(
      resolveEffectiveBillingStatus(
        {
          platformSubscriptionStatus: "canceled",
          accessMode: "complimentary",
          accessExpiresAt: null,
        },
        now
      ),
      "active"
    );
  });

  it("expires a time-limited complimentary grant", () => {
    assert.equal(
      resolveEffectiveBillingStatus(
        {
          platformSubscriptionStatus: "canceled",
          accessMode: "complimentary",
          accessExpiresAt: "2026-08-29T12:00:00.000Z",
        },
        now
      ),
      "canceled"
    );
  });

  it("keeps an unexpired manual trial open", () => {
    assert.equal(
      resolveEffectiveBillingStatus(
        {
          platformSubscriptionStatus: "canceled",
          accessMode: "trial",
          accessExpiresAt: "2026-09-15T12:00:00.000Z",
        },
        now
      ),
      "trialing"
    );
  });
});
