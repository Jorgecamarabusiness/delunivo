import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  validateCourseCheckoutSession,
  validatePlatformCheckoutSession,
} from "./checkoutValidation.ts";

const courseAttempt = {
  checkout_kind: "course_purchase",
  organization_id: "org-1",
  user_id: "user-1",
  course_id: "course-1",
  stripe_account_id: "acct_teacher",
  expected_amount_total: 12_000,
  expected_currency: "eur",
};

function courseSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: "cs_course",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency: "eur",
    amount_total: 12_000,
    client_reference_id: "user-1",
    metadata: {
      user_id: "user-1",
      course_id: "course-1",
      organization_id: "org-1",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("course Checkout validation", () => {
  it("accepts the exact paid Connect Checkout", () => {
    assert.equal(
      validateCourseCheckoutSession({
        session: courseSession(),
        attempt: courseAttempt,
        connectedAccountId: "acct_teacher",
      }),
      null
    );
  });

  it("rejects a Checkout from a different connected account", () => {
    assert.match(
      validateCourseCheckoutSession({
        session: courseSession(),
        attempt: courseAttempt,
        connectedAccountId: "acct_attacker",
      }) ?? "",
      /cuenta conectada/i
    );
  });

  it("rejects unpaid or economically different Checkouts", () => {
    assert.match(
      validateCourseCheckoutSession({
        session: courseSession({ payment_status: "unpaid" }),
        attempt: courseAttempt,
        connectedAccountId: "acct_teacher",
      }) ?? "",
      /todavía no está pagada/i
    );
    assert.match(
      validateCourseCheckoutSession({
        session: courseSession({ amount_total: 100 }),
        attempt: courseAttempt,
        connectedAccountId: "acct_teacher",
      }) ?? "",
      /importe/i
    );
  });

  it("rejects changed identity or course metadata", () => {
    assert.match(
      validateCourseCheckoutSession({
        session: courseSession({
          metadata: {
            user_id: "user-1",
            course_id: "course-other",
            organization_id: "org-1",
          },
        }),
        attempt: courseAttempt,
        connectedAccountId: "acct_teacher",
      }) ?? "",
      /identidad o el curso/i
    );
  });
});

describe("platform Checkout validation", () => {
  const attempt = {
    checkout_kind: "platform_subscription",
    organization_id: "org-1",
    user_id: "owner-1",
    expected_currency: "eur",
  };

  it("accepts a completed trial that needs no immediate payment", () => {
    const session = courseSession({
      mode: "subscription",
      payment_status: "no_payment_required",
      client_reference_id: "owner-1",
      metadata: { organization_id: "org-1", user_id: "owner-1" },
    });
    assert.equal(validatePlatformCheckoutSession({ session, attempt }), null);
  });

  it("rejects a subscription for another organization", () => {
    const session = courseSession({
      mode: "subscription",
      client_reference_id: "owner-1",
      metadata: { organization_id: "org-other", user_id: "owner-1" },
    });
    assert.match(
      validatePlatformCheckoutSession({ session, attempt }) ?? "",
      /empresa o el propietario/i
    );
  });
});
