import "server-only";
import { stripe } from "./client";
import { OFFER_VERSION } from "@/lib/billing/catalog";
import { assertCapacityPrice, type CapacityPriceKey } from "./capacityPriceValidation";
import { assertPilotTaxRate, fiscalPolicyRequired } from "@/lib/billing/fiscalPolicy";

export type { CapacityPriceKey } from "./capacityPriceValidation";
export async function capacityPrice(key: CapacityPriceKey, settlementOnly = false) {
  const variable = `STRIPE_PRICE_${key.toUpperCase()}_20261001`;
  const id = process.env[variable];
  if (!id) throw new Error(`Falta ${variable}. La oferta aún no está activada.`);
  const price = await stripe.prices.retrieve(id, { expand: ["product"] });
  assertCapacityPrice(price, key);
  if (!settlementOnly && price.livemode && (process.env.PLATFORM_TAX_LIVE_APPROVED !== OFFER_VERSION || !process.env.PLATFORM_TAX_RATE_ID)) throw new Error("Activación LIVE impedida: falta verificar el tratamiento fiscal de la oferta.");
  return price;
}

export async function platformTaxRates() {
  const id = process.env.PLATFORM_TAX_RATE_ID;
  if (!id) {
    if (fiscalPolicyRequired()) throw new Error("La tarifa fiscal del piloto aún no está configurada.");
    return [];
  }
  const rate = await stripe.taxRates.retrieve(id);
  if (!rate.active || !rate.inclusive) throw new Error("La tarifa fiscal debe estar activa y ser inclusiva.");
  if (fiscalPolicyRequired()) assertPilotTaxRate(rate);
  return [rate.id];
}
