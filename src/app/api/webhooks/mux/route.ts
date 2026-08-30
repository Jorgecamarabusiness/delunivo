import { NextResponse } from "next/server";
import { createMuxWebhookClient } from "@/lib/mux/config";
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
