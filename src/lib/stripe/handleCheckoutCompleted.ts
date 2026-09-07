import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCourseCheckoutSession } from "./checkoutValidation";

/** Validate Stripe's signed/retrieved receipt, then reconcile in one DB transaction. */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, connectedAccountId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: attempt, error } = await admin.from("stripe_checkout_attempts")
    .select("id,checkout_kind,organization_id,user_id,historical_user_id,course_id,stripe_account_id,expected_amount_total,expected_currency")
    .eq("stripe_session_id", session.id).maybeSingle();
  if (error || !attempt) throw new Error("No existe un intento de pago registrado para esta sesión.");
  const validationError = validateCourseCheckoutSession({ session, attempt: { ...attempt, user_id: attempt.user_id ?? attempt.historical_user_id }, connectedAccountId });
  if (validationError) throw new Error(validationError);
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const completed = await admin.rpc("complete_course_checkout", {
    p_attempt_id: attempt.id, p_session_id: session.id, p_account_id: connectedAccountId,
    p_amount_cents: session.amount_total, p_currency: session.currency,
    p_payment_intent_id: paymentIntent ?? null,
  });
  if (completed.error) throw new Error("No se pudo conciliar el recibo de pago.");
}
