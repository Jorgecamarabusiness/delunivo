import type Stripe from "stripe";
import { getPlan, LIBRARY_EXTENSION, DELIVERY_PACK, OFFER_VERSION, type PlanKey } from "../billing/catalog.ts";

export type CapacityPriceKey = PlanKey | "library" | "delivery_pack";

export function assertCapacityPrice(price: Stripe.Price, key: CapacityPriceKey) {
  const plan = getPlan(key);
  const expected = plan?.priceCents ?? (key === "library" ? LIBRARY_EXTENSION.priceCents : DELIVERY_PACK.priceCents);
  const product = price.product;
  if (typeof product === "string" || product.deleted || product.metadata.offer_version !== OFFER_VERSION || product.metadata.capacity_key !== key || !price.active || price.unit_amount !== expected || price.currency !== "eur" || price.tax_behavior !== "inclusive" || (key === "delivery_pack" ? price.recurring !== null : price.recurring?.interval !== "month" || price.recurring.interval_count !== 1)) {
    throw new Error("La configuración de precio no coincide con la oferta aceptada.");
  }
}
