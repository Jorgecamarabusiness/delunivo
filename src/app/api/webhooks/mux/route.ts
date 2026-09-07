import { NextResponse } from "next/server";
import { createMuxApiClient, createMuxWebhookClient } from "@/lib/mux/config";
import { processMuxWebhookEvent } from "@/lib/mux/webhookProcessor";
import { createSupabaseMuxWebhookRepository } from "@/lib/mux/supabaseWebhookRepository";
import type { MuxWebhookEventLike } from "@/lib/mux/events";

export async function POST(request: Request) {
  const body = await request.text();

  let event: MuxWebhookEventLike;
  try {
    const mux = createMuxWebhookClient();
    event = (await mux.webhooks.unwrap(
      body,
      request.headers
    )) as unknown as MuxWebhookEventLike;
  } catch {
    return NextResponse.json({ error: "Firma de Mux inválida." }, { status: 400 });
  }

  try {
    // Partial update events must not invalidate a previously usable school video.
    // Resolve missing fields from the authenticated provider before validating.
    if ((event.type === "video.asset.ready" || event.type === "video.asset.updated") &&
        (event.type === "video.asset.ready" || event.data.status === "ready") &&
        (!Array.isArray(event.data.tracks) || typeof event.data.duration !== "number" || !Array.isArray(event.data.playback_ids))) {
      if (typeof event.data.id !== "string" || !event.data.id) throw new Error("asset_id_missing");
      const asset = await createMuxApiClient().video.assets.retrieve(event.data.id);
      event = { ...event, data: asset as unknown as Record<string, unknown> };
    }
    const result = await processMuxWebhookEvent(
      event,
      createSupabaseMuxWebhookRepository()
    );
    return NextResponse.json({ received: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar el evento de Mux." },
      { status: 500 }
    );
  }
}
