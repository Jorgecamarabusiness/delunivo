import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";
import { handleCheckoutSessionCompleted } from "./handleCheckoutCompleted";
import { handlePlatformSubscriptionCheckout } from "./handlePlatformBilling";
import type { CheckoutAttempt } from "./checkoutAttempts";
import { fulfilCapacityCheckout } from "./capacityBilling";
import { readAllRows } from "@/lib/billing/readAllRows";

/** Confirm terminal Stripe state before a free grant or identity deletion. */
export async function settleOpenCheckouts(userId: string, courseId?: string) {
  const admin = createAdminClient();
  const result = await readAllRows((from, to) => {
    let query = admin
      .from("stripe_checkout_attempts")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["creating", "open", "completed"]);
    if (courseId)
      query = query
        .eq("course_id", courseId)
        .eq("checkout_kind", "course_purchase");
    return query.order("id").range(from, to);
  });
  if (result.error)
    throw new Error("No se pudieron comprobar los pagos abiertos.");
  for (const attempt of (result.data ?? []) as CheckoutAttempt[]) {
    const operationId = attempt.stripe_params.metadata?.capacity_operation_id;
    if (attempt.status === "completed") {
      if (!operationId) continue;
      const operation = await admin
        .from("platform_billing_operations")
        .select("applied_at")
        .eq("id", operationId)
        .eq("organization_id", attempt.organization_id)
        .single();
      if (operation.error)
        throw new Error("No se pudo verificar la capacidad pagada.");
      if (operation.data.applied_at) continue;
    }
    if (
      !attempt.stripe_session_id &&
      Date.now() - Date.parse(attempt.created_at) >= 23 * 60 * 60 * 1000
    ) {
      throw new Error("provider_reconciliation_required");
    }
    const options: Stripe.RequestOptions = attempt.stripe_account_id
      ? { stripeAccount: attempt.stripe_account_id }
      : {};
    // Replaying a lost creation response uses exactly the original idempotency key.
    let session = attempt.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(
          attempt.stripe_session_id,
          {},
          options,
        )
      : await stripe.checkout.sessions.create(attempt.stripe_params, {
          ...options,
          idempotencyKey: `delunivo-checkout-${attempt.id}`,
        });
    if (!attempt.stripe_session_id) {
      const saved = await admin
        .from("stripe_checkout_attempts")
        .update({
          stripe_session_id: session.id,
          stripe_session_url: session.url,
        })
        .eq("id", attempt.id);
      if (saved.error)
        throw new Error("No se pudo registrar el pago conciliado.");
    }
    if (session.status === "open") {
      try {
        session = await stripe.checkout.sessions.expire(
          session.id,
          {},
          options,
        );
      } catch {
        session = await stripe.checkout.sessions.retrieve(
          session.id,
          {},
          options,
        );
      }
    }
    if (session.status === "complete") {
      if (
        attempt.checkout_kind === "course_purchase" &&
        attempt.stripe_account_id
      )
        await handleCheckoutSessionCompleted(
          session,
          attempt.stripe_account_id,
        );
      else {
        if (session.mode === "subscription")
          await handlePlatformSubscriptionCheckout(
            session,
            new Date(session.created * 1000),
          );
        if (operationId) await fulfilCapacityCheckout(session);
        else if (session.mode !== "subscription")
          throw new Error("Pago de plataforma sin atribución.");
      }
    } else if (session.status === "expired") {
      const saved = await admin
        .from("stripe_checkout_attempts")
        .update({
          status: "expired",
          stripe_session_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.id)
        .in("status", ["creating", "open"]);
      if (saved.error) throw new Error("No se pudo cerrar el pago caducado.");
      if (operationId) {
        const expired = await admin
          .from("platform_billing_operations")
          .update({ status: "expired" })
          .eq("id", operationId)
          .eq("organization_id", attempt.organization_id)
          .is("applied_at", null);
        if (expired.error)
          throw new Error("No se pudo cerrar la operación de capacidad.");
      }
    } else
      throw new Error(
        "El proveedor todavía no ha confirmado el cierre del pago.",
      );
  }
}
