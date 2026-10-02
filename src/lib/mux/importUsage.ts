import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxApiClient } from "./config";
import { collectUsageHour, type DeliveryPage } from "./usageImport";
import { latestCompleteHour } from "@/lib/billing/allocation";
import { randomUUID } from "node:crypto";

export async function importMuxUsage(start: Date, end: Date) {
  const environment = process.env.MUX_ENVIRONMENT_ID;
  if (!environment || environment === "legacy-unverified")
    throw new Error("MUX_ENVIRONMENT_ID no verificado.");
  const from = start.getTime(),
    to = end.getTime();
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from % 3600000 ||
    to % 3600000 ||
    to > latestCompleteHour(new Date()) ||
    from < Math.ceil((Date.now() - 90 * 86400000) / 3600000) * 3600000 ||
    to <= from ||
    to - from > 24 * 3600000
  )
    throw new Error(
      "Ventana de importación inválida (máximo 24 horas fiables dentro de los últimos 90 días).",
    );
  const admin = createAdminClient();
  const mux = createMuxApiClient();
  const token = randomUUID();
  const claim = await admin.rpc("claim_mux_import", {
    p_environment: environment,
    p_token: token,
  });
  if (claim.error || !claim.data)
    throw new Error(
      "Otra importación de Mux está en curso o no pudo verificarse su exclusión.",
    );
  let completed = 0;
  try {
    for (let hour = from; hour < to; hour += 3600000) {
      const startsAt = new Date(hour).toISOString();
      try {
        const rows = await collectUsageHour(
          {
            async page(a, b, page) {
            const renewed=await admin.rpc("renew_mux_import",{p_environment:environment,p_token:token});
            if(renewed.error || !renewed.data) throw new Error("mux_import_lease_lost");
              // Read raw body: mux-node PageWithTimeframe drops total_row_count.
              const response = await mux.video.deliveryUsage
                .list({ timeframe: [String(a), String(b)], limit: 100, page })
                .asResponse();
              return (await response.json()) as DeliveryPage;
            },
          },
          hour / 1000,
        );
        // Attribution and coverage are persisted atomically behind the lease.
        const applied = await admin.rpc("replace_mux_usage_hour_leased", {
          p_environment: environment,
          p_start: startsAt,
          p_rows: rows,
          p_token: token,
        });
        if (applied.error) throw new Error(applied.error.message);
        completed++;
      } catch (error) {
        const lease = await admin
          .from("mux_import_workers")
          .select("claim_token,lease_until")
          .eq("environment", environment)
          .single();
        if (
          lease.error ||
          lease.data.claim_token !== token ||
          Date.parse(lease.data.lease_until) <= Date.now()
        )
          throw new Error(
            "La importación perdió su turno; no se modifica la cobertura fiable.",
          );
        // Preserve previously complete coverage; errors are a separate observation.
        const existing = await admin
          .from("mux_usage_imports")
          .select("status")
          .eq("environment", environment)
          .eq("starts_at", startsAt)
          .maybeSingle();
        const message =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "usage_import_failed";
        if (existing.data?.status === "complete")
          await admin
            .from("mux_usage_imports")
            .update({ error_message: message })
            .eq("environment", environment)
            .eq("starts_at", startsAt);
        else
          await admin
            .from("mux_usage_imports")
            .upsert({
              environment,
              starts_at: startsAt,
              ends_at: new Date(hour + 3600000).toISOString(),
              status: "failed",
              error_message: message,
            });
        throw new Error(`Importación Mux detenida en ${startsAt}: ${message}`);
      }
    }
    return { completed, start: start.toISOString(), end: end.toISOString() };
  } finally {
    await admin
      .from("mux_import_workers")
      .update({ claim_token: null, lease_until: null })
      .eq("environment", environment)
      .eq("claim_token", token);
  }
}

/** Revisit older hours for late data and corrections; never infer zero coverage. */
export async function importMuxHistoricalWindow() {
  const environment = process.env.MUX_ENVIRONMENT_ID;
  if (!environment) throw new Error("Entorno Mux pendiente.");
  const admin = createAdminClient();
  const saved = await admin
    .from("mux_import_workers")
    .select("history_cursor")
    .eq("environment", environment)
    .maybeSingle();
  if (saved.error) throw new Error("Cursor de consumo no verificado.");
  const earliest = Math.ceil((Date.now() - 90 * 86400000) / 3600000) * 3600000;
  const reliableEnd = latestCompleteHour(new Date());
  const cursor = Math.max(
    earliest,
    Date.parse(saved.data?.history_cursor ?? "") || earliest,
  );
  const start = cursor >= reliableEnd ? earliest : cursor;
  const end = Math.min(start + 24 * 3600000, reliableEnd);
  const result = await importMuxUsage(new Date(start), new Date(end));
  const update = await admin
    .from("mux_import_workers")
    .update({ history_cursor: new Date(end).toISOString() })
    .eq("environment", environment);
  if (update.error)
    throw new Error("Importación guardada; cursor pendiente de recuperación.");
  return result;
}
