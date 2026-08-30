import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MuxWebhookEventLike } from "./events";
import type {
  MuxWebhookClaim,
  MuxWebhookRepository,
} from "./webhookProcessor";

function throwDatabaseError(message: string): never {
  throw new Error(`No se pudo procesar el webhook de Mux: ${message}`);
}

export function createSupabaseMuxWebhookRepository(): MuxWebhookRepository {
  const admin = createAdminClient();

  return {
    async claim(event: MuxWebhookEventLike): Promise<MuxWebhookClaim> {
      const { data, error } = await admin.rpc("claim_mux_webhook_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_payload: event,
        p_mux_created_at: event.created_at,
      });

      if (error) throwDatabaseError(error.message);
      if (data !== "claimed" && data !== "duplicate" && data !== "in_progress") {
        throwDatabaseError("resultado de idempotencia no reconocido");
      }
      return data;
    },

    async apply(transition) {
      const { error } = await admin.rpc("apply_mux_video_event", {
        p_video_asset_id: transition.videoAssetId,
        p_mux_upload_id: transition.uploadId,
        p_mux_asset_id: transition.assetId,
        p_mux_playback_id: transition.playbackId,
        p_status: transition.status,
        p_event_created_at: transition.eventCreatedAt,
        p_duration_seconds: transition.durationSeconds,
        p_aspect_ratio: transition.aspectRatio,
        p_error_type: transition.errorType,
        p_error_message: transition.errorMessage,
      });
      if (error) throwDatabaseError(error.message);
    },

    async complete(eventId) {
      const { error } = await admin
        .from("mux_webhook_events")
        .update({
          status: "completed",
          last_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);
      if (error) throwDatabaseError(error.message);
    },

    async fail(eventId, message) {
      const { error } = await admin
        .from("mux_webhook_events")
        .update({ status: "failed", last_error: message.slice(0, 1_000) })
        .eq("event_id", eventId);
      if (error) throwDatabaseError(error.message);
    },
  };
}
