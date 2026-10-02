import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { FISCAL_POLICY_VERSION } from "../billing/fiscalPolicy.ts";
import type { CheckoutAttempt } from "./checkoutAttempts.ts";

const registry = globalThis as unknown as Record<string, unknown>;
const key = "__capacityFiscalTransport";
const originalApproval = process.env.PLATFORM_TAX_LIVE_APPROVED;
const originalRate = process.env.PLATFORM_TAX_RATE_ID;
process.env.PLATFORM_TAX_LIVE_APPROVED = "2026-10-01";
process.env.PLATFORM_TAX_RATE_ID = "txr_pilot";
type Resolution = { url: string; shortCircuit?: boolean };
type Resolve = (s: string, c: { parentURL?: string }) => Resolution;
const { registerHooks } = nodeModule as unknown as { registerHooks: (h: { resolve: (s: string, c: { parentURL?: string }, next: Resolve) => Resolution }) => { deregister: () => void } };
const hooks = registerHooks({ resolve(s, context, next) {
  const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  if (s === "server-only") return stub("export {};");
  if (s === "@/lib/supabase/admin") return stub(`export const createAdminClient=()=>globalThis.${key}.db;`);
  if (s === "./client" && context.parentURL?.endsWith("/capacityFiscal.ts"))
    return stub(`export const stripe=new Proxy({}, {get:(_,k)=>globalThis.${key}.stripe[k]});`);
  if (s === "@/lib/billing/fiscalPolicy") return { url: new URL("../billing/fiscalPolicy.ts", import.meta.url).href, shortCircuit: true };
  if (s === "@/lib/billing/catalog") return { url: new URL("../billing/catalog.ts", import.meta.url).href, shortCircuit: true };
  if (context.parentURL?.endsWith("/settleOpenCheckouts.ts")) {
    if (s === "./client") return stub(`export const stripe=new Proxy({}, {get:(_,k)=>globalThis.${key}.stripe[k]});`);
    if (s === "@/lib/billing/readAllRows") return stub(`export const readAllRows=async()=>({data:globalThis.${key}.settlementAttempts,error:null});`);
    if (s === "./handleCheckoutCompleted") return stub("export const handleCheckoutSessionCompleted=async()=>{};");
    if (s === "./handlePlatformBilling") return stub("export const handlePlatformSubscriptionCheckout=async()=>{};");
    if (s === "./capacityBilling") return stub("export const fulfilCapacityCheckout=async()=>{};");
  }
  return next(s, context);
} });
after(() => {
  hooks.deregister(); delete registry[key];
  if (originalApproval === undefined) delete process.env.PLATFORM_TAX_LIVE_APPROVED; else process.env.PLATFORM_TAX_LIVE_APPROVED = originalApproval;
  if (originalRate === undefined) delete process.env.PLATFORM_TAX_RATE_ID; else process.env.PLATFORM_TAX_RATE_ID = originalRate;
});

const domicile = { name: "Synthetic Fiscal School", address: { country: "ES" as const, postal_code: "28001", line1: "Prueba 1", city: "Madrid" } };
type Customer = { id: string; name?: string; tax_exempt: string; metadata: Record<string, string>; address?: typeof domicile.address };
function fixture(existing = false) {
  const customers = new Map<string, Customer>();
  if (existing) customers.set("cus_legacy", { id: "cus_legacy", tax_exempt: "none", metadata: {} });
  const rows: Record<string, string | null>[] = [{ organization_id: "school", platform_stripe_customer_id: existing ? "cus_legacy" : null }];
  const attempts: Record<string, string | null>[] = [{ id: "attempt", status: "open" }];
  const idempotency = new Map<string, string>();
  const calls = { created: 0, updated: 0, expired: 0, createdCheckout: 0 };
  const settlementAttempts: CheckoutAttempt[] = [];
  let sessionStatus = "open";
  class Query {
    checks: ((r: Record<string, string | null>) => boolean)[] = [];
    mutation: Record<string, string | null> | null = null;
    readonly table: string;
    constructor(table: string) { this.table = table; }
    select() { return this; }
    update(value: Record<string, string | null>) { this.mutation = value; return this; }
    eq(k: string, value: string) { this.checks.push(r => r[k] === value); return this; }
    neq(k: string, value: string) { this.checks.push(r => r[k] !== value); return this; }
    is(k: string, value: null) { this.checks.push(r => r[k] === value); return this; }
    in(k: string, values: string[]) { this.checks.push(r => values.includes(r[k] as string)); return this; }
    limit() { return this; }
    result(single = false) {
      const found = (this.table === "organization_billing" ? rows : attempts).filter(r => this.checks.every(check => check(r)));
      if (this.mutation) for (const r of found) Object.assign(r, this.mutation);
      return { data: single ? found[0] ?? null : found, error: null };
    }
    async single() { return this.result(true); }
    async maybeSingle() { return this.result(true); }
    then(resolve: (result: ReturnType<Query["result"]>) => unknown) { return Promise.resolve(this.result()).then(resolve); }
  }
  registry[key] = { settlementAttempts, db: { from: (table: string) => new Query(table) }, stripe: {
    taxRates: { async retrieve() { return {active:true,inclusive:true,percentage:21,country:"ES",tax_type:"vat"}; } },
    customers: {
      async create(value: typeof domicile & { metadata: Record<string, string> }, options: { idempotencyKey: string }) {
        let id = idempotency.get(options.idempotencyKey);
        if (!id) { id = `cus_${++calls.created}`; idempotency.set(options.idempotencyKey, id); customers.set(id, { id, ...structuredClone(value), tax_exempt: "none" }); }
        return structuredClone(customers.get(id)!);
      },
      async retrieve(id: string) { return structuredClone(customers.get(id)!); },
      async update(id: string, value: Partial<Customer>) { calls.updated++; Object.assign(customers.get(id)!, structuredClone(value)); return structuredClone(customers.get(id)!); },
    },
    checkout: { sessions: {
      async create() { calls.createdCheckout++; return {id:"cs_fixture",status:"open",url:"https://synthetic.invalid"}; },
      async retrieve() { return { id: "cs_fixture", status: sessionStatus }; },
      async expire() { calls.expired++; sessionStatus = "expired"; return { id: "cs_fixture", status: sessionStatus }; },
    } },
  } };
  return { rows, customers, calls, attempts, settlementAttempts, setSessionStatus: (status: string) => { sessionStatus = status; } };
}
fixture();
const { prepareCapacityFiscalCustomer, assertCapacityFiscalCustomer, assertCapacityFiscalAttempt } = await import("./capacityFiscal.ts");
const { settleOpenCheckouts } = await import("./settleOpenCheckouts.ts");
const attempt = (overrides: Partial<CheckoutAttempt> = {}): CheckoutAttempt => ({
  id: "attempt", organization_id: "school", user_id: "owner", checkout_kind: "platform_subscription", course_id: null,
  stripe_account_id: null, stripe_session_id: "cs_fixture", stripe_session_url: "https://synthetic.invalid", status: "open",
  expected_amount_total: null, expected_currency: "eur", expires_at: null, created_at: new Date().toISOString(),
  stripe_params: { mode:"subscription", subscription_data:{default_tax_rates:["txr_pilot"]}, customer: "cus_legacy", customer_update: { address: "never", name: "never" }, metadata: {
    capacity_operation_id: "operation", fiscal_policy_version: FISCAL_POLICY_VERSION }, line_items: [{ price: "price", tax_rates: ["txr_pilot"] }] }, ...overrides,
});

test("concurrent fiscal bootstrap persists one idempotent Customer and no raw domicile in Supabase", async () => {
  const f = fixture();
  const ids = await Promise.all([prepareCapacityFiscalCustomer("school", domicile), prepareCapacityFiscalCustomer("school", domicile)]);
  assert.equal(ids[0], ids[1]); assert.equal(f.calls.created, 1);
  assert.deepEqual(Object.keys(f.rows[0]).sort(), ["organization_id", "platform_stripe_customer_id"]);
  assert.equal(await assertCapacityFiscalCustomer("school"), ids[0]);
});
test("legacy binding can adopt confirmed domicile but another organization or shared Customer cannot", async () => {
  const f = fixture(true);
  assert.equal(await prepareCapacityFiscalCustomer("school", domicile), "cus_legacy");
  f.customers.get("cus_legacy")!.metadata.organization_id = "other";
  const writes = f.calls.updated;
  await assert.rejects(prepareCapacityFiscalCustomer("school", domicile), /cliente fiscal/);
  assert.equal(f.calls.updated, writes);
  f.rows.push({organization_id:"other",platform_stripe_customer_id:"cus_legacy"});
  await assert.rejects(assertCapacityFiscalCustomer("school"), /atribución segura/);
});
test("creation/reuse boundary rejects pre-policy attempts and expires unsafe open Checkout", async () => {
  const f = fixture(true);
  await prepareCapacityFiscalCustomer("school", domicile);
  await assertCapacityFiscalAttempt(attempt());
  await assert.rejects(assertCapacityFiscalAttempt(attempt({stripe_params:{customer:"cus_legacy",metadata:{capacity_operation_id:"operation"}}})), /política fiscal/);
  assert.equal(f.calls.expired, 1); assert.equal(f.attempts[0].status, "expired");
  f.customers.get("cus_legacy")!.address!.postal_code = "35001";
  await assert.rejects(assertCapacityFiscalAttempt(attempt({status:"creating",stripe_session_id:null})), /domicilio fiscal/);
  assert.equal(f.calls.created, 0);
});
test("completed unsafe session is preserved for payment reconciliation", async () => {
  const f = fixture(true);
  await prepareCapacityFiscalCustomer("school", domicile);
  f.setSessionStatus("complete");
  f.customers.get("cus_legacy")!.tax_exempt = "exempt";
  await assert.rejects(assertCapacityFiscalAttempt(attempt()), /domicilio fiscal/);
  assert.equal(f.calls.expired, 0); assert.equal(f.attempts[0].status, "open");
});
test("subscription recovery rejects correct initial VAT with missing recurring VAT", async () => {
  const f = fixture(true);
  await prepareCapacityFiscalCustomer("school", domicile);
  const params = attempt().stripe_params;
  params.subscription_data = {};
  await assert.rejects(assertCapacityFiscalAttempt(attempt({stripe_params:params})), /política fiscal/);
  assert.equal(f.calls.expired, 1);
  assert.equal(f.calls.createdCheckout, 0);
});
test("identity deletion never recreates an unknown chargeable platform Checkout", async () => {
  const f = fixture();
  f.settlementAttempts.push(attempt({status:"creating",stripe_session_id:null,stripe_params:{mode:"subscription",metadata:{capacity_operation_id:"operation"}}}));
  await assert.rejects(settleOpenCheckouts("owner"), /provider_reconciliation_required/);
  assert.equal(f.calls.createdCheckout, 0);
  assert.equal(f.calls.created, 0);
});
