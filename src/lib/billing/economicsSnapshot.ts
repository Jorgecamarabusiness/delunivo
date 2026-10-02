import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllRows } from "./readAllRows";

/** Private platform economics, separate from customers' entitlements. */
export async function getSchoolEconomics(
  orgId: string,
  start: string | null,
  end: string | null,
) {
  const db = createAdminClient();
  const storage = await db.rpc("platform_school_storage", {
    p_organization_id: orgId,
  });
  const files = storage.data as
    | { size_bytes: number | null; download_allowed: boolean }[]
    | null;
  const storageBytes = storage.error
    ? null
    : (files ?? [])
        .filter((f) => f.download_allowed && f.size_bytes !== null)
        .reduce((n, f) => n + Number(f.size_bytes), 0);
  const unknownStorageFiles = storage.error
    ? null
    : (files ?? []).filter((f) => !f.download_allowed || f.size_bytes === null)
        .length;
  if (!start || !end)
    return {
      storageBytes,
      unknownStorageFiles,
      costs: null,
      partialMarginEur: null,
      reason: "Ciclo pendiente; no se presenta margen.",
    };
  const [costs, invoices, packs, refunds] = await Promise.all([
    readAllRows((from, to) =>
      db
        .from("platform_provider_cost_lines")
        .select("statement_id,amount_micro_units,starts_at,ends_at")
        .eq("organization_id", orgId)
        .gte("starts_at", start)
        .lte("ends_at", end)
        .order("statement_id")
        .order("line_key")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      db
        .from("platform_invoice_ledger")
        .select("amount_paid_cents,currency,provider_snapshot")
        .eq("organization_id", orgId)
        .gte("paid_at", start)
        .lt("paid_at", end)
        .order("invoice_id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      db
        .from("platform_delivery_packs")
        .select("id,paid_cents,provider_payment_snapshot")
        .eq("organization_id", orgId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("id")
        .range(from, to),
    ),
    db
      .from("platform_pack_refunds")
      .select("amount_cents,platform_delivery_packs!inner(organization_id)")
      .eq("platform_delivery_packs.organization_id", orgId)
      .gte("effective_at", start)
      .lt("effective_at", end),
  ]);
  if (costs.error || invoices.error || packs.error || refunds.error)
    return {
      storageBytes,
      unknownStorageFiles,
      costs: null,
      partialMarginEur: null,
      reason: "Datos económicos pendientes de conciliación.",
    };
  const ids = [...new Set(costs.data!.map((c) => c.statement_id))];
  const statements = ids.length
    ? await db
        .from("platform_provider_statements")
        .select("id,currency,usd_to_eur,fx_at,fx_source,source")
        .in("id", ids)
    : { data: [], error: null };
  if (statements.error)
    return {
      storageBytes,
      unknownStorageFiles,
      costs: null,
      partialMarginEur: null,
      reason: "Fuentes de coste pendientes.",
    };
  const gross: Record<string, number> = {};
  let converted = 0;
  let conversionKnown = true;
  for (const line of costs.data!) {
    const source = statements.data!.find((s) => s.id === line.statement_id);
    if (!source) {
      conversionKnown = false;
      continue;
    }
    const amount = Number(line.amount_micro_units) / 1_000_000;
    gross[source.currency] = (gross[source.currency] ?? 0) + amount;
    if (source.currency === "eur") converted += amount;
    else if (source.currency === "usd" && source.usd_to_eur)
      converted += amount * Number(source.usd_to_eur);
    else conversionKnown = false;
  }
  let incomeNet = 0;
  let incomeKnown =
    invoices.data!.length > 0 || packs.data!.some((p) => p.paid_cents !== null);
  for (const invoice of invoices.data!) {
    const taxes = invoice.provider_snapshot?.total_taxes as
      | { amount: number }[]
      | undefined;
    if (invoice.currency !== "eur" || !Array.isArray(taxes)) {
      incomeKnown = false;
      continue;
    }
    incomeNet +=
      (Number(invoice.amount_paid_cents) -
        taxes.reduce((n, t) => n + Number(t.amount), 0)) /
      100;
  }
  for (const pack of packs.data!) {
    if (pack.paid_cents === null) continue;
    const tax = pack.provider_payment_snapshot?.tax_cents;
    if (!Number.isSafeInteger(tax)) {
      incomeKnown = false;
      continue;
    }
    incomeNet += (Number(pack.paid_cents) - Number(tax)) / 100;
  }
  // Refunded tax cannot be invented from a ratio. Wait for actual fiscal evidence.
  if (refunds.data!.length) incomeKnown = false;
  return {
    storageBytes,
    unknownStorageFiles,
    costs: costs.data!.length ? gross : null,
    partialMarginEur:
      incomeKnown && conversionKnown && costs.data!.length
        ? incomeNet - converted
        : null,
    reason:
      "Margen parcial: cobros del ciclo netos de impuestos confirmados menos costes brutos atribuidos en ventanas enteras de fuente. Excluye costes sin atribuir, intervalos que cruzan la frontera, Stripe, soporte y gastos pendientes; sin repartir créditos de cuenta.",
  };
}
