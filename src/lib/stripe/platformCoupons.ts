import "server-only";

import type { DiscountDuration } from "@/lib/billing/access";
import { stripe } from "./client";

export async function createPlatformCoupon({
  organizationId,
  organizationName,
  percentOff,
  duration,
}: {
  organizationId: string;
  organizationName: string;
  percentOff: number;
  duration: DiscountDuration;
}) {
  return stripe.coupons.create(
    {
      percent_off: percentOff,
      duration,
      name:
        percentOff === 100
          ? `Invitación gratuita · ${organizationName}`
          : `${percentOff}% · ${organizationName}`,
      metadata: { organization_id: organizationId },
    },
    {
      idempotencyKey: `delunivo-coupon-${organizationId}-${percentOff}-${duration}`,
    }
  );
}
