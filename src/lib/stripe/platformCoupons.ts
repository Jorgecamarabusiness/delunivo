import "server-only";

import type { DiscountDuration } from "@/lib/billing/access";
import { createHash } from "node:crypto";
import { stripe } from "./client";

export async function createPlatformCoupon({
  organizationId,
  organizationName,
  percentOff,
  duration,
  productIds,
}: {
  organizationId: string;
  organizationName: string;
  percentOff: number;
  duration: DiscountDuration;
  productIds?: string[];
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
      ...(productIds ? { applies_to: { products: productIds } } : {}),
    },
    {
      idempotencyKey: `delunivo-coupon-${organizationId}-${percentOff}-${duration}${productIds ? `-${createHash("sha256").update([...productIds].sort().join(":" )).digest("hex").slice(0,16)}` : ""}`,
    }
  );
}
