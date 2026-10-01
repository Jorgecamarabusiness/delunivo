import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxApiClient } from "./config";
import { collectUsageHour, type DeliveryPage } from "./usageImport";
import { latestCompleteHour } from "@/lib/billing/allocation";
import { isUuid } from "./validation";

export async function importMuxUsage(start: Date, end: Date) {
  const environment = process.env.MUX_ENVIRONMENT_ID;
  if (!environment || environment === "legacy-unverified") throw new Error("MUX_ENVIRONMENT_ID no verificado.");
  const from = start.getTime(), to = end.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from % 3600000 || to % 3600000 || to > latestCompleteHour(new Date()) || to <= from || to - from > 24 * 3600000) throw new Error("Ventana de importación inválida (máximo 24 horas fiables).");
  const admin = createAdminClient(); const mux = createMuxApiClient();
  let completed = 0;
  for (let hour = from; hour < to; hour += 3600000) {
    const startsAt = new Date(hour).toISOString();
    try {
      const rows = await collectUsageHour({ async page(a, b, page) {
        // Read raw body: mux-node PageWithTimeframe drops total_row_count.
        const response = await mux.video.deliveryUsage.list({ timeframe: [String(a), String(b)], limit: 100, page }).asResponse();
        return await response.json() as DeliveryPage;
      } }, hour / 1000);
      // Provider passthrough plus an exact asset ID, never a guessed school.
      for (const row of rows) {
        if (!isUuid(row.passthrough)) continue;
        const ledger = await admin.from("mux_asset_ledger").select("video_asset_id,mux_asset_id,environment").eq("video_asset_id", row.passthrough).maybeSingle();
        if (ledger.error) throw new Error(ledger.error.message);
        if (ledger.data?.mux_asset_id !== row.asset_id || ![environment, "legacy-unverified"].includes(ledger.data.environment)) continue;
        const createdAt = Number(row.created_at);
        const saved = await admin.from("mux_asset_ledger").update({ environment,
          ...(Number.isFinite(createdAt) ? { provider_created_at: new Date(createdAt * 1000).toISOString(), minimum_storage_until: new Date((createdAt + 30 * 86400) * 1000).toISOString() } : {}),
        }).eq("video_asset_id", row.passthrough).eq("mux_asset_id", row.asset_id);
        if (saved.error) throw new Error(saved.error.message);
      }
      const applied = await admin.rpc("replace_mux_usage_hour", { p_environment: environment, p_start: startsAt, p_rows: rows });
      if (applied.error) throw new Error(applied.error.message);
      completed++;
    } catch (error) {
      // Preserve previously complete coverage; errors are a separate observation.
      const existing = await admin.from("mux_usage_imports").select("status").eq("environment", environment).eq("starts_at", startsAt).maybeSingle();
      const message = error instanceof Error ? error.message.slice(0, 500) : "usage_import_failed";
      if (existing.data?.status === "complete") await admin.from("mux_usage_imports").update({ error_message: message }).eq("environment", environment).eq("starts_at", startsAt);
      else await admin.from("mux_usage_imports").upsert({ environment, starts_at: startsAt, ends_at: new Date(hour + 3600000).toISOString(), status: "failed", error_message: message });
      throw new Error(`Importación Mux detenida en ${startsAt}: ${message}`);
    }
  }
  return { completed, start: start.toISOString(), end: end.toISOString() };
}
