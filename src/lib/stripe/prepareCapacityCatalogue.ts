import "server-only";
import type Stripe from "stripe";
import { PLANS, OFFER_VERSION, LIBRARY_EXTENSION, DELIVERY_PACK } from "../billing/catalog.ts";
import { assertCapacityPrice, type CapacityPriceKey } from "./capacityPriceValidation.ts";

/** Fixed offer only. No tax registration, customer, payment or subscription calls. */
export async function prepareCapacityCatalogue(stripe: Stripe) {
  const entries: { key: CapacityPriceKey; name: string; amount: number }[] = [
    ...PLANS.map(p => ({ key: p.key, name: p.name, amount: p.priceCents })),
    { key: "library", name: "Biblioteca adicional 10 h", amount: LIBRARY_EXTENSION.priceCents },
    { key: "delivery_pack", name: "Bolsa de entrega 5.000 min", amount: DELIVERY_PACK.priceCents },
  ];
  const results: { key: CapacityPriceKey; priceId: string }[] = [];
  for (const entry of entries) {
    const productId = `delunivo_20261001_${entry.key}`;
    const metadata = { offer_version: OFFER_VERSION, capacity_key: entry.key };
    let product: Stripe.Product | Stripe.DeletedProduct;
    try { product = await stripe.products.retrieve(productId); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "resource_missing") throw error;
      product = await stripe.products.create({ id: productId, name: `Delunivo ${entry.name} · ${OFFER_VERSION}`, metadata },
        { idempotencyKey: `delunivo-product-${OFFER_VERSION}-${entry.key}` });
    }
    if (product.deleted || !product.active || !product.livemode || product.metadata.offer_version !== OFFER_VERSION || product.metadata.capacity_key !== entry.key) {
      throw new Error("El producto versionado requiere revisión.");
    }
    const lookupKey = `delunivo_${entry.key}_20261001`;
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 2 });
    if (existing.has_more || existing.data.length > 1) throw new Error("Precio versionado ambiguo.");
    let price = existing.data[0];
    if (!price) {
      price = await stripe.prices.create({ product: product.id, lookup_key: lookupKey,
        currency: "eur", unit_amount: entry.amount, tax_behavior: "inclusive", metadata,
        ...(entry.key === "delivery_pack" ? {} : { recurring: { interval: "month" } }),
      }, { idempotencyKey: `delunivo-price-${OFFER_VERSION}-${entry.key}` });
    }
    if (!price.livemode || (typeof price.product === "string" ? price.product : price.product.id) !== product.id) {
      throw new Error("Precio de otra cuenta, modo o producto.");
    }
    assertCapacityPrice({ ...price, product }, entry.key);
    results.push({ key: entry.key, priceId: price.id });
  }
  return results;
}
