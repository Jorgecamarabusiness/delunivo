import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";
import { handleCheckoutSessionCompleted } from "./handleCheckoutCompleted";
import { handlePlatformSubscriptionCheckout } from "./handlePlatformBilling";
import type { CheckoutAttempt } from "./checkoutAttempts";

/** Confirm terminal Stripe state before a free grant or identity deletion. */
export async function settleOpenCheckouts(userId: string, courseId?: string) {
  const admin = createAdminClient();
  let query = admin.from("stripe_checkout_attempts").select("*").eq("user_id", userId).in("status", ["creating", "open"]);
  if (courseId) query = query.eq("course_id", courseId).eq("checkout_kind", "course_purchase");
  const result = await query;
  if (result.error) throw new Error("No se pudieron comprobar los pagos abiertos.");
  for (const attempt of (result.data ?? []) as CheckoutAttempt[]) {
    if (!attempt.stripe_session_id && Date.now() - Date.parse(attempt.created_at) >= 23 * 60 * 60 * 1000) {
      throw new Error("provider_reconciliation_required");
    }
    const options: Stripe.RequestOptions = attempt.stripe_account_id ? { stripeAccount: attempt.stripe_account_id } : {};
    // Replaying a lost creation response uses exactly the original idempotency key.
    let session = attempt.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(attempt.stripe_session_id, {}, options)
      : await stripe.checkout.sessions.create(attempt.stripe_params, { ...options, idempotencyKey: `delunivo-checkout-${attempt.id}` });
    if (!attempt.stripe_session_id) {
      const saved = await admin.from("stripe_checkout_attempts").update({ stripe_session_id: session.id, stripe_session_url: session.url }).eq("id", attempt.id);
      if (saved.error) throw new Error("No se pudo registrar el pago conciliado.");
    }
    if (session.status === "open") {
      try { session = await stripe.checkout.sessions.expire(session.id, {}, options); }
      catch { session = await stripe.checkout.sessions.retrieve(session.id, {}, options); }
    }
    if (session.status === "complete") {
      if (attempt.checkout_kind === "course_purchase" && attempt.stripe_account_id) await handleCheckoutSessionCompleted(session, attempt.stripe_account_id);
      else await handlePlatformSubscriptionCheckout(session, new Date(session.created * 1000));
    } else if (session.status === "expired") {
      const saved = await admin.from("stripe_checkout_attempts").update({ status: "expired", stripe_session_url: null, updated_at: new Date().toISOString() }).eq("id", attempt.id).in("status", ["creating", "open"]);
      if (saved.error) throw new Error("No se pudo cerrar el pago caducado.");
    } else throw new Error("El proveedor todavía no ha confirmado el cierre del pago.");
  }
}
