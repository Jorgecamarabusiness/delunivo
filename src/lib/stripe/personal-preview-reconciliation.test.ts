import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { after, test } from "node:test";

const key = "__delunivoPausedReconciliation";
const registry = globalThis as unknown as Record<string, unknown>;
const previous = process.env.PERSONAL_PREVIEW_MODE;
type Resolution = { url: string; shortCircuit?: boolean };
type Resolve = (specifier: string, context: { parentURL?: string }) => Resolution;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: (s: string, c: { parentURL?: string }, next: Resolve) => Resolution }) => { deregister: () => void } };
const hooks = registerHooks({ resolve(s, c, next) {
  const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  if (s === "server-only") return stub("export {};");
  if (s === "@/lib/supabase/admin") return stub(`export const createAdminClient=()=>globalThis.${key}.db;`);
  if (s === "@/lib/personal-preview") return { url: new URL("../personal-preview.ts", import.meta.url).href, shortCircuit: true };
  if (s === "@/lib/billing/catalog") return { url: new URL("../billing/catalog.ts", import.meta.url).href, shortCircuit: true };
  if (s === "@/lib/billing/rollout") return stub("export const plansEnabledForSchool=()=>true;");
  if (s === "@/lib/billing/readAllRows") return stub("export const readAllRows=async()=>({data:[],error:null});");
  if (s === "@/lib/billing/fiscalPolicy") return stub("export const fiscalPolicyRequired=()=>false; export const FISCAL_POLICY_VERSION='synthetic';");
  if (c.parentURL?.endsWith("/capacityBilling.ts")) {
    if (s === "./client") return stub(`export const stripe=new Proxy({}, {get:(_,name)=>globalThis.${key}.stripe[name]});`);
    if (s === "./capacityPrices") return stub("export const capacityPrice=async()=>null; export const platformTaxRates=async()=>[];");
    if (s === "./platformDiscounts") return stub("export const ensureOrganizationDiscountCoupon=async()=>null;");
    if (s === "./checkoutAttempts") return stub("export const claimCheckoutAttempt=async()=>null; export const getCheckoutUrlForAttempt=async()=>null; export const markCheckoutAttemptCompleted=async()=>null;");
    if (s === "./handlePlatformBilling") return stub("export const handlePlatformSubscriptionCheckout=async()=>null;");
    if (s === "./paidAffiliateInvoice") return stub("export const applyPaidAffiliateInvoice=async()=>null;");
    if (s === "./capacityEvents") return stub("export const reconcileCapacitySubscription=async()=>null;");
    if (s === "./capacityFiscal") return stub("export const assertCapacityFiscalAttempt=async()=>null; export const assertCapacityFiscalCustomer=async()=> 'cus_fixture'; export const prepareCapacityFiscalCustomer=async()=> 'cus_fixture';");
  }
  return next(s, c);
} });
const { reconcileCapacityOperation } = await import("./capacityBilling.ts");
after(() => { hooks.deregister(); delete registry[key]; if (previous === undefined) delete process.env.PERSONAL_PREVIEW_MODE; else process.env.PERSONAL_PREVIEW_MODE = previous; });

function fixture(kind: "resume" | "cancel") {
  const calls: Array<Record<string, unknown>> = [];
  const op = { id: "operation", organization_id: "school", kind, status: "processing", applied_at: null, quote: { subscriptionId: "sub_fixture" } };
  const query = { select: () => query, eq: () => query, update: () => query, single: async () => ({ data: op, error: null }), then: (resolve: (result: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  registry[key] = { db: { from: () => query }, stripe: { subscriptions: { retrieve: async () => ({ id: "sub_fixture", customer: "cus_fixture", schedule: null }), update: async (_id: string, values: Record<string, unknown>) => { calls.push(values); return {}; } } } };
  return calls;
}

test("daily worker cannot resume a paid subscription during personal preview", async () => {
  process.env.PERSONAL_PREVIEW_MODE = "true";
  const calls = fixture("resume");
  await assert.rejects(reconcileCapacityOperation("operation"), /Proyecto personal en pausa/);
  assert.deepEqual(calls, []);
});

test("existing cancellation can still reconcile while new paid activation is paused", async () => {
  process.env.PERSONAL_PREVIEW_MODE = "true";
  const calls = fixture("cancel");
  await reconcileCapacityOperation("operation");
  assert.deepEqual(calls, [{ cancel_at_period_end: true }]);
});

test("the shared pause gate is reversible without changing the stored operation", async () => {
  process.env.PERSONAL_PREVIEW_MODE = "false";
  const calls = fixture("resume");
  await reconcileCapacityOperation("operation");
  assert.deepEqual(calls, [{ cancel_at_period_end: false }]);
});
