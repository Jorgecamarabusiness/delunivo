import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleCheckoutSessionCompleted } from "@/lib/stripe/handleCheckoutCompleted";

function id(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id ?? null; }

async function reconcileAdjustment(event: Stripe.Event, account: string) {
  const object = event.data.object as unknown as { id: string; charge?: string | Stripe.Charge; payment_intent?: string | Stripe.PaymentIntent };
  const isDispute = event.type.startsWith("charge.dispute.");
  let dispute: Stripe.Dispute | null = null;
  let charge: Stripe.Charge;
  if (isDispute) {
    dispute = await stripe.disputes.retrieve(object.id, {}, { stripeAccount: account });
    charge = await stripe.charges.retrieve(id(dispute.charge)!, {}, { stripeAccount: account });
  } else if (event.type.startsWith("refund.")) {
    const refund = await stripe.refunds.retrieve(object.id, {}, { stripeAccount: account });
    if (!id(refund.charge)) return;
    charge = await stripe.charges.retrieve(id(refund.charge)!, {}, { stripeAccount: account });
  } else charge = await stripe.charges.retrieve(object.id, {}, { stripeAccount: account });
  const paymentIntent = id(charge.payment_intent);
  if (!paymentIntent) return;
  const admin = createAdminClient();
  const purchase = await admin.from("purchases").select("id").eq("stripe_account_id", account).eq("stripe_payment_intent_id", paymentIntent).maybeSingle();
  if (purchase.error) throw new Error("purchase_lookup_failed");
  if (!purchase.data) {
    // Covers adjustments delivered before checkout completion, and older receipts
    // whose payment_intent was not stored by the previous application version.
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 10 }, { stripeAccount: account });
    const session = sessions.data.find(s => s.metadata?.course_id && s.metadata?.organization_id);
    if (!session) return; // Other sales made by the connected account are outside Delunivo.
    const attempt = await admin.from("stripe_checkout_attempts").select("id,status").eq("stripe_session_id", session.id).eq("stripe_account_id", account).maybeSingle();
    if (attempt.error) throw new Error("attempt_lookup_failed");
    if (!attempt.data) return;
    if (attempt.data.status === "completed") {
      const linked = await admin.from("purchases").update({ stripe_account_id: account, stripe_payment_intent_id: paymentIntent }).eq("external_reference", session.id).eq("organization_id", session.metadata!.organization_id);
      if (linked.error) throw new Error("legacy_receipt_link_failed");
    } else await handleCheckoutSessionCompleted(session, account);
  }
  const adjusted = await admin.rpc("apply_course_payment_adjustment", {
    p_account: account, p_payment_intent: paymentIntent,
    p_refunded_cents: charge.amount_refunded,
    p_dispute_status: dispute?.status ?? null, p_event_at: new Date(event.created * 1000).toISOString(),
  });
  if (adjusted.error) throw new Error("payment_adjustment_failed");
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Falta la firma de Stripe." }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!); }
  catch { return NextResponse.json({ error: "Firma inválida." }, { status: 400 }); }
  if (event.livemode !== process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) return NextResponse.json({ received: true, ignored: "stripe_mode_mismatch" });
  const supported = event.type === "checkout.session.completed" || event.type === "account.updated" || event.type === "charge.refunded" || event.type.startsWith("refund.") || event.type.startsWith("charge.dispute.");
  if (!supported) return NextResponse.json({ received: true });
  if (!event.account) return NextResponse.json({ error: "Falta la cuenta conectada." }, { status: 400 });
  const admin = createAdminClient();
  const claimed = await admin.rpc("claim_connect_event", { p_id: event.id, p_account: event.account, p_type: event.type });
  if (claimed.error || claimed.data === "in_progress") return NextResponse.json({ error: "Evento pendiente de conciliación." }, { status: 503 });
  if (claimed.data === "completed") return NextResponse.json({ received: true });
  if (claimed.data !== "claimed") return NextResponse.json({ error: "No se pudo reservar el evento." }, { status: 503 });
  try {
    if (event.type === "checkout.session.completed") await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, event.account);
    else if (event.type === "account.updated") {
      if (event.data.object.id !== event.account) throw new Error("account_mismatch");
      // Read the provider's current state, so a delayed payload cannot regress it.
      const account = await stripe.accounts.retrieve(event.account);
      const updated = await admin.from("organization_integrations").update({ stripe_connect_status: account.charges_enabled && account.payouts_enabled && account.details_submitted ? "connected" : "pending" }).eq("stripe_account_id", account.id);
      if (updated.error) throw new Error("account_update_failed");
    } else await reconcileAdjustment(event, event.account);
    const completed = await admin.from("stripe_connect_webhook_events").update({ status: "completed", lease_until: null, last_error_code: null, updated_at: new Date().toISOString() }).eq("event_id", event.id);
    if (completed.error) throw new Error("event_completion_failed");
    return NextResponse.json({ received: true });
  } catch {
    await admin.from("stripe_connect_webhook_events").update({ status: "failed", lease_until: null, last_error_code: "reconciliation_failed", updated_at: new Date().toISOString() }).eq("event_id", event.id);
    return NextResponse.json({ error: "No se pudo conciliar el evento; se reintentará." }, { status: 500 });
  }
}
