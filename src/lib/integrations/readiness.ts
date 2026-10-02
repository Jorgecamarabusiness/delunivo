import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { rejectSensitiveActionDuringImpersonation } from "@/lib/auth/impersonation";
import { createStripeApiClient } from "@/lib/stripe/config";
import { createMuxApiClient } from "@/lib/mux/config";
import { PLANS } from "../billing/catalog.ts";
import { assertCapacityPrice, type CapacityPriceKey } from "../stripe/capacityPriceValidation.ts";
import { assertPilotTaxRate } from "../billing/fiscalPolicy.ts";


// Fixed, read-only provider calls with explicit projections. Never return SDK
// objects, environment values, raw errors, credentials or customer records.
async function probe<T>(read: () => Promise<T>) {
  try { return { state: "verified" as const, data: await read() }; }
  catch { return { state: "unknown" as const }; }
}

export async function readIntegrationReadiness() {
  const supabase = await createClient();
  const auth = await requireSuperAdmin(supabase);
  if (auth.error) return { ok: false as const, error: "platform_admin_required" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || await rejectSensitiveActionDuringImpersonation(user.id))
    return { ok: false as const, error: "platform_admin_session_required" };

  let stripeClient: ReturnType<typeof createStripeApiClient> | undefined;
  const stripe = () => stripeClient ??= createStripeApiClient();
  const [account, rates, registrations, webhooks, prices, mux] = await Promise.all([
    probe(async () => {
      const a = await stripe().accounts.retrieveCurrent();
      return { id: a.id, country: a.country, chargesEnabled: a.charges_enabled,
        payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted,
        requirementsDue: a.requirements?.currently_due ?? [], disabledReason: a.requirements?.disabled_reason ?? null };
    }),
    probe(async () => {
      const r = await stripe().taxRates.list({ active: true, limit: 100 });
      const configured = r.data.find(t => t.id === process.env.PLATFORM_TAX_RATE_ID);
      let pilotTaxVerified = false;
      if (configured?.livemode) {
        try { assertPilotTaxRate(configured); pilotTaxVerified = true; } catch { /* Invalid configuration remains visible as unverified. */ }
      }
      return { truncated: r.has_more, pilotTaxVerified, rates: r.data.map(t => ({ id: t.id, country: t.country,
        state: t.state, percentage: t.percentage, inclusive: t.inclusive, live: t.livemode })) };
    }),
    probe(async () => {
      const r = await stripe().tax.registrations.list({ limit: 100 });
      return { truncated: r.has_more, registrations: r.data.map(t => ({ country: t.country, status: t.status })) };
    }),
    probe(async () => {
      const r = await stripe().webhookEndpoints.list({ limit: 100 });
      return { truncated: r.has_more, endpoints: r.data.map(w => {
        const url = new URL(w.url);
        const route = url.pathname === "/api/webhooks/stripe" ? "stripe" :
          url.pathname === "/api/webhooks/stripe-connect" ? "stripe-connect" : "other";
        return { id: w.id, destinationHost: url.hostname, route, status: w.status,
          live: w.livemode, events: w.enabled_events };
      }) };
    }),
    probe(async () => {
      const r = await stripe().prices.list({ active: true, limit: 100, expand: ["data.product"] });
      const versioned = r.data.filter(p => typeof p.product !== "string" &&
        !p.product.deleted && p.product.metadata.offer_version === "2026-10-01");
      const keys: CapacityPriceKey[] = [...PLANS.map(p => p.key), "library", "delivery_pack"];
      const catalogueVerified = !r.has_more && versioned.length === keys.length && keys.every(key => {
        const matches = versioned.filter(p => typeof p.product !== "string" && !p.product.deleted &&
          p.product.metadata.capacity_key === key && p.lookup_key === `delunivo_${key}_20261001`);
        if (matches.length !== 1 || !matches[0].livemode) return false;
        try { assertCapacityPrice(matches[0], key); return true; } catch { return false; }
      });
      return { truncated: r.has_more, catalogueVerified, prices: versioned.map(p => ({
        id: p.id, currency: p.currency, amount: p.unit_amount, taxBehavior: p.tax_behavior,
        interval: p.recurring?.interval ?? null, live: p.livemode,
        capacityKey: typeof p.product === "string" || p.product.deleted ? null : p.product.metadata.capacity_key,
      })) };
    }),
    probe(async () => {
      const m = await createMuxApiClient().system.utilities.whoami();
      return { organizationId: m.organization_id, organizationName: m.organization_name,
        environmentId: m.environment_id, environmentName: m.environment_name,
        environmentType: m.environment_type, permissions: m.permissions,
        configuredEnvironmentMatches: process.env.MUX_ENVIRONMENT_ID === m.environment_id };
    }),
  ]);
  return { ok: true as const, report: { inspectedAt: new Date().toISOString(),
    stripeMode: /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") ? "live" : "other",
    account, rates, registrations, webhooks, prices, mux,
    controls: { plans: process.env.PLATFORM_PLANS_ENABLED === "true",
      worker: process.env.PLATFORM_CAPACITY_WORKER_ENABLED === "true",
      usageImport: process.env.MUX_USAGE_IMPORT_ENABLED === "true",
      capacityNotices: process.env.PLATFORM_CAPACITY_NOTICES_ENABLED === "true",
      retentionExecution: process.env.PLATFORM_RETENTION_EXECUTE === "2026-10-01",
      muxDeletionDisabled: process.env.MUX_DELETION_MODE === "off",
      taxLiveApproved: process.env.PLATFORM_TAX_LIVE_APPROVED === "2026-10-01",
    } } };
}
