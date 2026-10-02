import assert from "node:assert/strict";
import { after, test } from "node:test";
import * as nodeModule from "node:module";
import type Stripe from "stripe";

type Result = { url: string; shortCircuit?: boolean };
type Resolve = (s: string, c: { parentURL?: string }) => Result;
const { registerHooks } = nodeModule as unknown as { registerHooks: (h: {
  resolve: (s: string, c: { parentURL?: string }, next: Resolve) => Result;
}) => { deregister: () => void } };
const hooks = registerHooks({ resolve(s, c, next) {
  return s === "server-only" ? { url: "data:text/javascript,export {};", shortCircuit: true } : next(s, c);
} });
after(() => hooks.deregister());
const { prepareCapacityCatalogue } = await import("./prepareCapacityCatalogue.ts");

function fixture() {
  const products = new Map<string, Stripe.Product>();
  const prices = new Map<string, Stripe.Price>();
  const writes: { type: string; id: string; key?: string }[] = [];
  let failure: string | null = null;
  const stripe = {
    products: {
      async retrieve(id: string) {
        if (failure === "read") throw { code: "api_error" };
        if (!products.has(id)) throw { code: "resource_missing" };
        return products.get(id)!;
      },
      async create(p: Stripe.ProductCreateParams, opts: Stripe.RequestOptions) {
        if (!products.has(p.id!)) {
          products.set(p.id!, { ...p, id: p.id, active: true, livemode: true } as Stripe.Product);
          writes.push({ type: "product", id: p.id!, key: opts.idempotencyKey });
        }
        return products.get(p.id!)!;
      },
    },
    prices: {
      async list(p: Stripe.PriceListParams) {
        return { has_more: false, data: p.lookup_keys?.flatMap(k => prices.has(k) ? [prices.get(k)!] : []) ?? [] };
      },
      async create(p: Stripe.PriceCreateParams, opts: Stripe.RequestOptions) {
        if (failure === p.product) throw { code: "api_error" };
        if (!prices.has(p.lookup_key!)) {
          prices.set(p.lookup_key!, { ...p, id: `price_${p.lookup_key}`, active: true, livemode: true,
            object: "price", created: 1, type: p.recurring ? "recurring" : "one_time",
            recurring: p.recurring ? { interval: p.recurring.interval, interval_count: 1 } : null } as Stripe.Price);
          writes.push({ type: "price", id: p.lookup_key!, key: opts.idempotencyKey });
        }
        return prices.get(p.lookup_key!)!;
      },
    },
  } as unknown as Stripe;
  return { stripe, products, prices, writes, fail: (value: string | null) => { failure = value; } };
}

test("catalogue prepares only the five accepted LIVE amounts with fixed products and inclusive taxes", async () => {
  const f = fixture();
  const result = await prepareCapacityCatalogue(f.stripe);
  assert.deepEqual(result.map(p => p.key), ["inicio", "crece", "academia", "library", "delivery_pack"]);
  assert.deepEqual([...f.prices.values()].map(p => p.unit_amount), [3000, 6900, 14900, 800, 2000]);
  assert.equal(f.writes.length, 10);
  for (const p of f.prices.values()) {
    assert.equal(p.currency, "eur"); assert.equal(p.tax_behavior, "inclusive");
    assert.equal(p.metadata.offer_version, "2026-10-01");
    assert.equal(p.recurring?.interval ?? null, p.metadata.capacity_key === "delivery_pack" ? null : "month");
  }
  assert.equal(new Set(f.writes.map(w => w.key)).size, 10);
});

test("catalogue retries and concurrent preparation reuse deterministic products and prices", async () => {
  const f = fixture();
  const [first, second] = await Promise.all([prepareCapacityCatalogue(f.stripe), prepareCapacityCatalogue(f.stripe)]);
  assert.deepEqual(first, second);
  assert.deepEqual(await prepareCapacityCatalogue(f.stripe), first);
  assert.equal(f.writes.length, 10);
});

test("an unknown provider read never creates a replacement product", async () => {
  const f = fixture(); f.fail("read");
  await assert.rejects(prepareCapacityCatalogue(f.stripe));
  assert.equal(f.writes.length, 0);
});

test("a partially prepared catalogue resumes without altering successful prices", async () => {
  const f = fixture(); f.fail("delunivo_20261001_academia");
  await assert.rejects(prepareCapacityCatalogue(f.stripe));
  const first = f.prices.get("delunivo_inicio_20261001");
  assert.equal(f.prices.size, 2);
  f.fail(null); await prepareCapacityCatalogue(f.stripe);
  assert.equal(f.prices.get("delunivo_inicio_20261001"), first);
  assert.equal(f.writes.length, 10);
});

test("a preexisting versioned price with different economics is rejected and never changed", async () => {
  const f = fixture(); await prepareCapacityCatalogue(f.stripe);
  for (const patch of [{ unit_amount: 1 }, { tax_behavior: "unspecified" }, { recurring: { interval: "year", interval_count: 1 } }, { currency: "usd" }, { active: false }]) {
    const original = f.prices.get("delunivo_inicio_20261001")!;
    f.prices.set("delunivo_inicio_20261001", { ...original, ...patch } as Stripe.Price);
    await assert.rejects(prepareCapacityCatalogue(f.stripe));
    assert.equal(f.writes.length, 10);
    f.prices.set("delunivo_inicio_20261001", original);
  }
});

test("a product from another mode or offer fails before further provider writes", async () => {
  const f = fixture(); await prepareCapacityCatalogue(f.stripe);
  const product = f.products.get("delunivo_20261001_inicio")!;
  f.products.set(product.id, { ...product, livemode: false });
  await assert.rejects(prepareCapacityCatalogue(f.stripe));
  assert.equal(f.writes.length, 10);
  f.products.set(product.id, { ...product, metadata: { offer_version: "legacy", capacity_key: "inicio" } });
  await assert.rejects(prepareCapacityCatalogue(f.stripe));
  assert.equal(f.writes.length, 10);
});

test("a reused lookup key belonging to another product is never reassigned", async () => {
  const f = fixture(); await prepareCapacityCatalogue(f.stripe);
  const price = f.prices.get("delunivo_inicio_20261001")!;
  f.prices.set("delunivo_inicio_20261001", { ...price, product: "prod_unrelated" });
  await assert.rejects(prepareCapacityCatalogue(f.stripe));
  assert.equal(f.writes.length, 10);
});
