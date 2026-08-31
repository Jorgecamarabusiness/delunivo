import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  markCheckoutAttemptCompleted,
  type CheckoutAttempt,
} from "./checkoutAttempts";
import { validateCourseCheckoutSession } from "./checkoutValidation";

/** Concede una compra solo cuando procede del Checkout Connect esperado. */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("stripe_checkout_attempts")
    .select(
      "id, checkout_kind, organization_id, user_id, course_id, stripe_account_id, expected_amount_total, expected_currency"
    )
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (attemptError || !attempt) {
    throw new Error("No existe un intento de pago registrado para esta sesión.");
  }

  const validationError = validateCourseCheckoutSession({
    session,
    attempt: attempt as CheckoutAttempt,
    connectedAccountId,
  });
  if (validationError) throw new Error(validationError);

  const courseId = attempt.course_id!;
  const userId = attempt.user_id;

  const [{ data: course }, { data: integration }] = await Promise.all([
    supabase
      .from("courses")
      .select("organization_id")
      .eq("id", courseId)
      .maybeSingle(),
    supabase
      .from("organization_integrations")
      .select("stripe_account_id, stripe_connect_status")
      .eq("organization_id", attempt.organization_id)
      .maybeSingle(),
  ]);

  if (!course || course.organization_id !== attempt.organization_id) {
    throw new Error("El curso ya no pertenece a la organización del pago.");
  }
  if (
    integration?.stripe_account_id !== connectedAccountId ||
    integration.stripe_connect_status !== "connected"
  ) {
    throw new Error("La cuenta conectada ya no está habilitada para esta organización.");
  }

  const amountPaid = session.amount_total! / 100;

  const { error } = await supabase.from("purchases").insert({
      user_id: userId,
      course_id: courseId,
      organization_id: attempt.organization_id,
      amount_paid: amountPaid,
      payment_method: "stripe",
      external_reference: session.id,
    });

  if (error) {
    if (error.code !== "23505") throw new Error(error.message);

    const { data: existingPurchase } = await supabase
      .from("purchases")
      .select("external_reference")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingPurchase?.external_reference !== session.id) {
      throw new Error("Ya existe una compra distinta para este alumno y curso.");
    }
  }

  // Si nunca se había unido al roster de esta organización (p. ej. compró
  // sin haberse registrado antes en su subdominio), se le añade activo. Si
  // ya existe una fila (incluso 'removed' por haber sido expulsado), no se
  // toca — una compra nunca reactiva a alguien echado automáticamente.
  const { data: existingMembership } = await supabase
    .from("organization_students")
    .select("id")
    .eq("organization_id", attempt.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await supabase
      .from("organization_students")
      .insert({
        organization_id: attempt.organization_id,
        user_id: userId,
        status: "active",
        joined_via: "purchase",
      });

    if (membershipError && membershipError.code !== "23505") {
      throw new Error(membershipError.message);
    }
  }

  await markCheckoutAttemptCompleted(attempt.id);
}
