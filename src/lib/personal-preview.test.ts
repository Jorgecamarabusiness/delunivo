import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, beforeEach, test } from "node:test";
import { isPersonalPreviewMode, PERSONAL_PREVIEW_MESSAGE } from "./personal-preview.ts";

const fixtureKey = "__delunivoPersonalPreviewTest";
const registry = globalThis as unknown as Record<string, unknown>;
const previousMode = process.env.PERSONAL_PREVIEW_MODE;
type ResolveResult = { url: string; shortCircuit?: boolean };
type NextResolve = (specifier: string, context: { parentURL?: string }) => ResolveResult;
type ResolveHook = (specifier: string, context: { parentURL?: string }, next: NextResolve) => ResolveResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => { deregister: () => void } };
const hooks = registerHooks({ resolve(specifier, context, next) {
  const stub = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  const state = `globalThis.${fixtureKey}`;
  const unexpected = "() => { throw new Error('Unexpected external operation'); }";
  if (specifier === "server-only") return stub("export {};");
  if (specifier === "next/navigation") return stub(`export const redirect = ${unexpected};`);
  if (specifier === "next/headers") return stub(`export const cookies = ${unexpected};`);
  if (specifier === "next/cache") return stub(`export const revalidatePath = ${unexpected};`);
  if (specifier === "@/lib/supabase/server") return stub(`export const createClient = async () => ${state}.supabase;`);
  if (specifier === "@/lib/supabase/admin") return stub(`export const createAdminClient = ${unexpected};`);
  if (specifier === "@/lib/organizations/getCurrentOrganization") return stub(`export const getCurrentOrganization = async () => ({id:'synthetic-school'});`);
  if (specifier === "@/lib/organizations/orgPath") return stub("export const orgPath = async path => path;");
  if (specifier === "@/lib/organizations/integrations") return stub(`export const getConnectedStripeAccountId = ${unexpected};`);
  if (specifier === "@/lib/organizations/requireOwnerContext") return stub(`export const requireOwnerContext = ${unexpected};`);
  if (specifier === "@/lib/auth/requireOrgAdmin") return stub(`export const requireSuperAdmin = ${unexpected};`);
  if (specifier === "@/lib/stripe/platformCoupons") return stub(`export const createPlatformCoupon = ${unexpected};`);
  if (specifier === "@/lib/stripe/platformDiscounts") return stub(`export const reconcileOrganizationCommercialTermsToStripe = ${unexpected};`);
  if (specifier === "@/lib/stripe/checkoutAttempts") return stub(`export const claimCheckoutAttempt = ${unexpected}; export const getCheckoutUrlForAttempt = ${unexpected};`);
  if (specifier === "@/lib/stripe/settleOpenCheckouts") return stub(`export const settleOpenCheckouts = async () => { ${state}.effects.push('reconcile'); };`);
  if (specifier === "@/lib/stripe/client") return stub("export const stripe = new Proxy({}, {get() {throw new Error('Unexpected Stripe request');}});");
  if (specifier === "@/lib/stripe/platformSubscription") return stub(`export const createPlatformSubscriptionCheckoutUrl = ${unexpected};`);
  if (specifier === "@/lib/stripe/capacityBilling") return stub(["createCapacityCheckout", "quoteCapacityChange", "confirmCapacityChange", "settleCapacityCheckouts", "recoverCapacityPayment"].map((name) => `export const ${name} = ${unexpected};`).join("\n"));
  if (specifier === "@/lib/auth/accounts") return stub(`export const createUnverifiedUser = ${unexpected};`);
  if (specifier === "@/lib/auth/verificationCodes") return stub(`export const issueVerificationCode = ${unexpected}; export const CODE_TTL_MINUTES=10;`);
  if (specifier === "@/lib/email/templates") return stub(`export const sendSignupCodeEmail = ${unexpected};`);
  if (specifier === "@/lib/auth/impersonation") return stub(`export const rejectSensitiveActionDuringImpersonation = ${unexpected};`);
  if (specifier.startsWith("@/")) {
    const url = new URL(`../${specifier.slice(2)}.ts`, import.meta.url);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
} });

const course = await import("../app/cursos/[id]/actions.ts");
const company = await import("../app/actions.ts");
const billing = await import("../app/admin/facturacion/actions.ts");
const capacity = await import("../app/admin/facturacion/capacityActions.ts");
const custom = await import("../app/a-medida/actions.ts");
const platform = await import("../app/admin/plataforma/actions.ts");

beforeEach(() => {
  process.env.PERSONAL_PREVIEW_MODE = "true";
  registry[fixtureKey] = { effects: [], supabase: { auth: { getUser: async () => ({ data: { user: { id: "synthetic-user" } } }) }, from: () => { throw new Error("Unexpected database read"); } } };
});
after(() => {
  hooks.deregister(); delete registry[fixtureKey];
  if (previousMode === undefined) delete process.env.PERSONAL_PREVIEW_MODE;
  else process.env.PERSONAL_PREVIEW_MODE = previousMode;
});

test("pause mode is explicit and reversible", () => {
  assert.equal(isPersonalPreviewMode(), true);
  process.env.PERSONAL_PREVIEW_MODE = "false";
  assert.equal(isPersonalPreviewMode(), false);
});

test("direct server actions cannot create schools, custom requests or any new checkout while paused", async () => {
  const form = new FormData();
  form.set("recoveryAction", "continue");
  const operations = [
    () => course.createStripeCheckoutAction("synthetic-course", true),
    () => company.createCompanyAction({ error: null }, form),
    () => billing.subscribeAction({ error: null }, form),
    () => billing.openBillingPortalAction({ error: null }, form),
    () => capacity.purchaseCapacityAction({ error: null }, form),
    () => capacity.previewCapacityAction({ error: null }, form),
    () => capacity.confirmCapacityAction({ error: null }, form),
    () => capacity.recoverCapacityAction({ error: null }, form),
    () => billing.ensureReferralCodeAction("synthetic-school"),
    () => custom.requestCustomPlan({ error: null }, form),
    () => platform.updateOrganizationCommercialTermsAction("synthetic-school", form),
    () => platform.updatePlatformPriceAction({ error: null }, form),
  ];
  for (const operation of operations) assert.equal((await operation()).error, PERSONAL_PREVIEW_MESSAGE);
});

test("already available free content can still grant access while purchases are paused", async () => {
  const effects: string[] = [];
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: "synthetic-course", price: 0, organization_id: "synthetic-school" } }) };
  registry[fixtureKey] = { effects, supabase: { auth: { getUser: async () => ({ data: { user: { id: "synthetic-user" } } }) }, from: () => query, rpc: async (name: string) => { effects.push(name); return { data: "granted", error: null }; } } };
  assert.deepEqual(await course.grantFreeCourseAccessAction("synthetic-course"), { granted: true, error: null });
  assert.deepEqual(effects, ["reconcile", "grant_free_course_access"]);
});
