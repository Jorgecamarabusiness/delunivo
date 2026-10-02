import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllRows } from "./readAllRows";
import { usageCoverage } from "./coverage";

export async function getSchoolUsageSnapshot(organizationId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const results = await Promise.all([
    admin
      .from("organization_billing")
      .select("*")
      .eq("organization_id", organizationId)
      .single(),
    admin.rpc("platform_library_usage", { p_organization_id: organizationId }),
    admin
      .from("platform_capacity_cycles")
      .select("*")
      .eq("organization_id", organizationId)
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    readAllRows((from, to) =>
      admin
        .from("platform_delivery_packs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("expires_at")
        .order("id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      admin
        .from("mux_asset_ledger")
        .select("environment")
        .eq("organization_id", organizationId)
        .order("video_asset_id")
        .range(from, to),
    ),
    admin
      .from("platform_billing_operations")
      .select(
        "id,kind,status,created_at,last_error,quote,invoice_id,checkout_attempt_id",
      )
      .eq("organization_id", organizationId)
      .in("status", ["processing", "pending_payment", "scheduled"])
      .order("created_at", { ascending: false }),
    admin
      .from("platform_invoice_ledger")
      .select("amount_paid_cents,currency,paid_at,invoice_id")
      .eq("organization_id", organizationId)
      .order("paid_at", { ascending: false })
      .limit(12),
    admin
      .from("platform_quota_exceptions")
      .select("*")
      .eq("organization_id", organizationId)
      .gt("expires_at", now),
    admin
      .from("platform_resource_notices")
      .select("resource,threshold,created_at,sent_at,last_error")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("platform_retention_jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  const failure = results.find((result) => result.error);
  if (failure)
    return {
      kind: "error" as const,
      message:
        "No se pudo verificar el consumo. La información no se interpreta como cero.",
    };
  const [
    billing,
    library,
    cycle,
    packs,
    assets,
    operations,
    invoices,
    exceptions,
    notices,
    retention,
  ] = results;
  const environmentIds = [
    ...new Set(
      [
        process.env.MUX_ENVIRONMENT_ID,
        ...(assets.data ?? []).map((asset) => asset.environment),
      ].filter((id): id is string => Boolean(id) && id !== "legacy-unverified"),
    ),
  ];
  const imports = environmentIds.length
    ? await readAllRows((from, to) =>
        admin
          .from("mux_usage_imports")
          .select(
            "environment,starts_at,ends_at,updated_at,status,error_message",
          )
          .in("environment", environmentIds)
          .gte(
            "starts_at",
            cycle.data?.starts_at ??
              new Date(Date.now() - 30 * 86400000).toISOString(),
          )
          .order("ends_at", { ascending: false })
          .order("environment")
          .range(from, to),
      )
    : { data: [], error: null };
  if (imports.error)
    return {
      kind: "error" as const,
      message: "La cobertura de consumo está pendiente de verificación.",
    };
  const complete = (imports.data ?? []).filter(
    (row) => row.status === "complete",
  );
  const increases = cycle.data
    ? await admin
        .from("platform_capacity_increases")
        .select("base_seconds,grace_seconds")
        .eq("cycle_id", cycle.data.id)
    : { data: [], error: null };
  if (increases.error)
    return {
      kind: "error" as const,
      message: "No se pudieron verificar los derechos de este ciclo.",
    };
  const refunds = (packs.data ?? []).length
    ? await admin
        .from("platform_pack_refunds")
        .select("pack_id,seconds")
        .in(
          "pack_id",
          packs.data!.map((p) => p.id),
        )
        .lte("effective_at", now)
    : { data: [], error: null };
  if (refunds.error)
    return {
      kind: "error" as const,
      message: "No se pudo conciliar el saldo de las bolsas.",
    };
  const windowStart =
    cycle.data?.starts_at ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const windowEnd = cycle.data?.ends_at ?? now;
  const usage = await readAllRows((from, to) =>
    admin
      .from("mux_usage_hours")
      .select("delivered_seconds")
      .eq("organization_id", organizationId)
      .gte("starts_at", windowStart)
      .lt("starts_at", windowEnd)
      .order("starts_at")
      .order("environment")
      .order("mux_asset_id")
      .range(from, to),
  );
  if (usage.error)
    return {
      kind: "error" as const,
      message: "No se pudo verificar la distribución del consumo.",
    };
  const confirmedSeconds = (usage.data ?? []).reduce(
    (n, row) => n + Number(row.delivered_seconds),
    0,
  );
  const reconciledPacks = (packs.data ?? []).map((pack) => ({
    ...pack,
    expired: Date.parse(pack.expires_at) <= Date.parse(now),
    remaining_seconds: Math.max(
      0,
      Number(pack.granted_seconds) -
        Number(pack.used_seconds) -
        (refunds.data ?? [])
          .filter((r) => r.pack_id === pack.id)
          .reduce((n, r) => n + Number(r.seconds), 0),
    ),
  }));
  const coverage = usageCoverage(
    imports.data ?? [],
    environmentIds,
    windowStart,
    windowEnd,
  );
  const confirmedUntil = coverage.confirmedThrough;
  const estimates = await admin.rpc("platform_recent_delivery_estimate", {
    p_organization_id: organizationId,
    p_start: windowStart,
    p_end: windowEnd,
  });
  const estimatedSeconds =
    estimates.error || estimates.data === null ? null : Number(estimates.data);
  return {
    kind: "ready" as const,
    billing: billing.data!,
    library: library.data,
    cycle: cycle.data
      ? {
          ...cycle.data,
          base_seconds:
            Number(cycle.data.base_seconds) +
            (increases.data ?? []).reduce(
              (n, i) => n + Number(i.base_seconds),
              0,
            ),
          grace_seconds:
            Number(cycle.data.grace_seconds) +
            (increases.data ?? []).reduce(
              (n, i) => n + Number(i.grace_seconds),
              0,
            ),
        }
      : null,
    packs: reconciledPacks,
    operations: operations.data ?? [],
    invoices: invoices.data ?? [],
    exceptions: exceptions.data ?? [],
    notices: notices.data ?? [],
    retention: retention.data,
    confirmedKnown: complete.length > 0,
    confirmedSeconds,
    estimatedSeconds,
    updatedAt: complete[0]?.updated_at ?? null,
    confirmedUntil,
    pending: coverage.pending,
    windowStart,
    windowEnd,
    missingHours: coverage.missingHours,
  };
}
