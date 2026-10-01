import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxApiClient } from "./config";
import { normalizeMuxVideoEvent } from "./events";
import { isUuid } from "./validation";

/** Authenticated snapshots recover lost webhooks and upload registration responses. */
export async function reconcileMuxAssets() {
  const environment = process.env.MUX_ENVIRONMENT_ID;
  if (!environment || environment === "legacy-unverified")
    throw new Error("Entorno Mux no verificado.");
  const db = createAdminClient(),
    mux = createMuxApiClient();
  let attributed = 0,
    unattributed = 0;
  for await (const asset of mux.video.assets.list({ limit: 100 })) {
    const found = await db
      .from("mux_asset_ledger")
      .select("video_asset_id,environment,mux_asset_id,deletion_confirmed_at")
      .eq(
        isUuid(asset.passthrough) ? "video_asset_id" : "mux_asset_id",
        isUuid(asset.passthrough) ? asset.passthrough! : asset.id,
      )
      .maybeSingle();
    if (found.error) throw new Error("Inventario Mux pendiente de conciliar.");
    const ledger = found.data;
    if (
      !ledger ||
      ![environment, "legacy-unverified"].includes(ledger.environment) ||
      (ledger.mux_asset_id && ledger.mux_asset_id !== asset.id)
    ) {
      unattributed++;
      continue;
    }
    if (ledger.deletion_confirmed_at) {
      unattributed++;
      continue;
    }
    const created = Number(asset.created_at);
    const update = await db
      .from("mux_asset_ledger")
      .update({
        environment,
        mux_asset_id: asset.id,
        ...(Number.isFinite(created)
          ? {
              provider_created_at: new Date(created * 1000).toISOString(),
              minimum_storage_until: new Date(
                (created + 30 * 86400) * 1000,
              ).toISOString(),
            }
          : {}),
      })
      .eq("video_asset_id", ledger.video_asset_id);
    if (update.error) throw new Error("Inventario Mux no guardado.");
    const local = await db
      .from("video_assets")
      .select("id,status")
      .eq("id", ledger.video_asset_id)
      .maybeSingle();
    if (local.error) throw new Error("Asset local pendiente de conciliar.");
    if (
      local.data &&
      ["waiting_for_upload", "processing"].includes(local.data.status) &&
      ["ready", "errored"].includes(asset.status)
    ) {
      const transition = normalizeMuxVideoEvent({
        id: `snapshot-${asset.id}`,
        type: "video.asset.updated",
        created_at: new Date().toISOString(),
        data: { ...asset, passthrough: ledger.video_asset_id },
      });
      if (transition) {
        if (asset.status === "errored") {
          transition.errorMessage =
            [transition.errorType, transition.errorMessage]
              .filter(Boolean)
              .join(": ") || "Mux no pudo procesar el archivo.";
          transition.errorType = "provider_processing_failed";
        }
        const applied = await db.rpc("recover_mux_asset_snapshot", {
          p_transition: transition,
        });
        if (applied.error)
          throw new Error("Snapshot Mux pendiente de conciliación.");
      }
    } else if (typeof asset.duration === "number" && asset.duration > 0) {
      // A processing snapshot can lag a ready webhook. Missing duration is
      // unknown, and must not erase the verified duration used for costs.
      const tombstone = await db
        .from("mux_asset_ledger")
        .update({ duration_seconds: asset.duration })
        .eq("video_asset_id", ledger.video_asset_id);
      if (tombstone.error)
        throw new Error("Coste de asset huérfano pendiente.");
    }
    attributed++;
  }
  const queued = await db.rpc("queue_rejected_mux_assets");
  if (queued.error)
    throw new Error("Limpieza de subidas rechazadas pendiente.");
  return { attributed, unattributed };
}
