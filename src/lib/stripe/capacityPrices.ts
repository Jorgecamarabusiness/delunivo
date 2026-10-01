import "server-only";
import { stripe } from "./client";
import { getPlan, LIBRARY_EXTENSION, DELIVERY_PACK, OFFER_VERSION, type PlanKey } from "@/lib/billing/catalog";

export type CapacityPriceKey = PlanKey | "library" | "delivery_pack";
export async function capacityPrice(key: CapacityPriceKey) {
  const variable = `STRIPE_PRICE_${key.toUpperCase()}_20261001`;
  const id = process.env[variable];
  if (!id) throw new Error(`Falta ${variable}. La oferta aún no está activada.`);
  const price = await stripe.prices.retrieve(id, { expand: ["product"] });
  const plan = getPlan(key);
  const expected = plan?.priceCents ?? (key === "library" ? LIBRARY_EXTENSION.priceCents : DELIVERY_PACK.priceCents);
  const product = price.product;
  if (typeof product === "string" || product.deleted || product.metadata.offer_version !== OFFER_VERSION || product.metadata.capacity_key !== key || !price.active || price.unit_amount !== expected || price.currency !== "eur" || price.tax_behavior !== "inclusive" || (key === "delivery_pack" ? price.recurring !== null : price.recurring?.interval !== "month" || price.recurring.interval_count !== 1)) throw new Error("La configuración de precio no coincide con la oferta aceptada.");
  if (price.livemode && (process.env.PLATFORM_TAX_LIVE_APPROVED !== OFFER_VERSION || !process.env.PLATFORM_TAX_RATE_ID)) throw new Error("Activación LIVE impedida: falta verificar el tratamiento fiscal de la oferta.");
  return price;
}

export async function platformTaxRates() {
  const id = process.env.PLATFORM_TAX_RATE_ID;
  if (!id) return [];
  const rate = await stripe.taxRates.retrieve(id);
  if (!rate.active || !rate.inclusive) throw new Error("La tarifa fiscal debe estar activa y ser inclusiva.");
  return [rate.id];
}
