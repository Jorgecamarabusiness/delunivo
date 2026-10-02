import assert from "node:assert/strict";
import { after, test } from "node:test";
import * as nodeModule from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLANS } from "../../../../../lib/billing/catalog.ts";

// Node runs each test file in a separate process. Exercise the real route and
// requireSuperAdmin with synthetic transports; no provider environment is loaded.
const key = "__delunivoReadinessTest";
const registry = globalThis as unknown as Record<string, unknown>;
type Result = { url: string; shortCircuit?: boolean };
type Resolve = (s: string, c: { parentURL?: string }) => Result;
const { registerHooks } = nodeModule as unknown as { registerHooks: (h: {
  resolve: (s: string, c: { parentURL?: string }, next: Resolve) => Result;
}) => { deregister: () => void } };
const hooks = registerHooks({ resolve(s, c, next) {
  const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  const state = `globalThis.${key}`;
  if (s === "next/navigation") return stub("export const redirect = path => { throw Error('redirect:' + path); };");
  if (s === "server-only") return stub("export {};");
  if (s === "@/lib/supabase/server") return stub(`export const createClient = async () => ${state}.supabase;`);
  if (s === "@/lib/auth/impersonation") return stub(`export const rejectSensitiveActionDuringImpersonation = async () => ${state}.runAs ? 'blocked' : null;`);
  if (s === "@/lib/stripe/config") return stub(`export const createStripeApiClient = () => { if (${state}.missingStripe) throw Error('private_missing_key'); return ${state}.stripe; };`);
  if (s === "@/lib/mux/config") return stub(`export const createMuxApiClient = () => ${state}.mux;`);
  if (s.startsWith("@/")) {
    const url = new URL(`../../../../../${s.slice(2)}.ts`, import.meta.url);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(s, c);
} });
after(() => { hooks.deregister(); delete registry[key]; });

let calls = 0;
function fixture(role: "anonymous" | "owner" | "platform", runAs = false, failure = false, missingStripe = false) {
  calls = 0;
  const read = <T>(data: T) => async () => {
    calls++;
    if (failure) throw new Error("provider_secret_must_never_escape");
    return data;
  };
  registry[key] = {
    runAs, missingStripe,
    supabase: { auth: { getUser: async () => ({ data: { user: role === "anonymous" ? null : { id: role } } }) },
      rpc: async () => ({ data: role === "platform" }) },
    stripe: {
      accounts: { retrieveCurrent: read({ id: "acct_fixture", country: "ES", charges_enabled: true, payouts_enabled: true,
        details_submitted: true, email: "private@invalid.example", requirements: { currently_due: [], disabled_reason: null } }) },
      taxRates: { list: read({ has_more: false, data: [{ id: "txr_fixture", country: "ES", state: null,
        percentage: 7, inclusive: true, livemode: false, description: "private_tax_details" }] }) },
      tax: { registrations: { list: read({ has_more: false, data: [] }) } },
      webhookEndpoints: { list: read({ has_more: false, data: [{ id: "we_fixture", url: "https://www.delunivo.com/api/webhooks/stripe?secret=private_query",
        status: "enabled", livemode: false, enabled_events: ["invoice.paid"], secret: "private_signing_secret" },
        { id: "we_other", url: "https://www.delunivo.com/hooks/private_path_token", status: "enabled", livemode: false, enabled_events: [] }] }) },
      prices: { list: read({ has_more: false, data: [] }) },
    },
    mux: { system: { utilities: { whoami: read({ organization_id: "fixture-org", organization_name: "Fixture",
      environment_id: "fixture-env", environment_name: "Fixture", environment_type: "test", permissions: [], access_token_name: "private_token_name" }) } } },
  };
}
fixture("anonymous");
const { GET } = await import("./route.ts");
const { prepareCatalogueAction } = await import("../../../../admin/plataforma/servicios/actions.ts");

for (const role of ["anonymous", "owner"] as const) {
  test(`readiness denies ${role} before any provider call`, async () => {
    fixture(role);
    const response = await GET();
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  });
}
test("readiness denies a platform identity during Run as", async () => {
  fixture("platform", true);
  assert.equal((await GET()).status, 403);
  assert.equal(calls, 0);
});
test("readiness returns only explicit provider projections", async () => {
  fixture("platform");
  const response = await GET();
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(calls, 6);
  assert.doesNotMatch(body, /private|provider_secret/);
  assert.equal(JSON.parse(body).account.data.id, "acct_fixture");
  assert.equal(JSON.parse(body).webhooks.data.endpoints[0].destinationHost, "www.delunivo.com");
  assert.equal(JSON.parse(body).webhooks.data.endpoints[0].route, "stripe");
  assert.equal(JSON.parse(body).webhooks.data.endpoints[1].route, "other");
});
test("provider failure remains unknown and never serializes raw errors", async () => {
  fixture("platform", false, true);
  const body = await (await GET()).json();
  for (const name of ["account", "rates", "registrations", "webhooks", "prices", "mux"])
    assert.deepEqual(body[name], { state: "unknown" });
  assert.doesNotMatch(JSON.stringify(body), /provider_secret/);
});
test("missing Stripe configuration does not bypass auth or fail route import", async () => {
  fixture("platform", false, false, true);
  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const name of ["account", "rates", "registrations", "webhooks", "prices"])
    assert.deepEqual(body[name], { state: "unknown" });
  assert.equal(body.mux.state, "verified");
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(body), /private_missing_key/);
});

test("catalogue server action rejects non-platform and Run as sessions before provider calls", async () => {
  for (const [role, runAs] of [["owner", false], ["anonymous", false], ["platform", true]] as const) {
    fixture(role, runAs);
    await assert.rejects(prepareCatalogueAction(), /redirect:\/admin$/);
    assert.equal(calls, 0);
  }
});

test("catalogue server action refuses an unverified account without provider writes", async () => {
  fixture("platform", false, true);
  await assert.rejects(prepareCatalogueAction(), /catalogue=failed/);
  assert.equal(calls, 6);
});

test("readiness validates each LIVE catalogue price rather than trusting a count of five", async () => {
  const entries = [...PLANS.map(p => ({ key: p.key, amount: p.priceCents })), { key: "library", amount: 800 }, { key: "delivery_pack", amount: 2000 }];
  const rows = entries.map(p => ({ id: `price_${p.key}`, active: true, livemode: true,
    currency: "eur", unit_amount: p.amount, tax_behavior: "inclusive", lookup_key: `delunivo_${p.key}_20261001`,
    product: { id: `prod_${p.key}`, metadata: { offer_version: "2026-10-01", capacity_key: p.key } },
    recurring: p.key === "delivery_pack" ? null : { interval: "month", interval_count: 1 },
  }));
  fixture("platform");
  const state = registry[key] as { stripe: { prices: { list: () => Promise<unknown> } } };
  const inspect = async (data: unknown[], hasMore = false) => {
    state.stripe.prices.list = async () => ({ data, has_more: hasMore });
    return (await (await GET()).json()).prices.data.catalogueVerified;
  };
  assert.equal(await inspect(rows), true);
  assert.equal(await inspect([rows[0], rows[1], rows[0], rows[3], rows[4]]), false);
  assert.equal(await inspect([{ ...rows[0], unit_amount: 1 }, ...rows.slice(1)]), false);
  assert.equal(await inspect([{ ...rows[0], lookup_key: "unrelated" }, ...rows.slice(1)]), false);
  assert.equal(await inspect(rows, true), false);
});
