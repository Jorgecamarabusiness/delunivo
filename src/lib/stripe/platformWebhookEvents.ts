import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformEventClaim = "claimed" | "duplicate" | "in_progress";

export async function claimPlatformWebhookEvent(
  eventId: string,
  eventType: string
): Promise<PlatformEventClaim> {
  const { data, error } = await createAdminClient().rpc(
    "claim_stripe_platform_webhook_event",
    { p_event_id: eventId, p_event_type: eventType }
  );
  if (error || !["claimed", "duplicate", "in_progress"].includes(String(data))) {
    throw new Error(error?.message ?? "No se pudo reclamar el evento de Stripe.");
  }
  return data as PlatformEventClaim;
}

export async function applyPlatformAffiliateEvent(params: {
  eventId: string;
  organizationId: string;
  eventKind: "invoice_paid" | "payment_failed" | "subscription_deleted";
  eventAt: Date;
  amountPaid?: number;
}): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc(
    "apply_stripe_affiliate_billing_event",
    {
      p_event_id: params.eventId,
      p_organization_id: params.organizationId,
      p_event_kind: params.eventKind,
      p_event_at: params.eventAt.toISOString(),
      p_amount_paid: params.amountPaid ?? 0,
    }
  );
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message ?? "No se pudo aplicar el evento de afiliación.");
  }
  return data.filter((value): value is string => typeof value === "string");
}

export async function completePlatformWebhookEvent(eventId: string) {
  const { error } = await createAdminClient()
    .from("stripe_platform_webhook_events")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("event_id", eventId)
    .eq("status", "processing");
  if (error) throw new Error(error.message);
}

export async function failPlatformWebhookEvent(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  await createAdminClient()
    .from("stripe_platform_webhook_events")
    .update({ status: "failed", last_error: message.slice(0, 2000) })
    .eq("event_id", eventId)
    .eq("status", "processing");
}
