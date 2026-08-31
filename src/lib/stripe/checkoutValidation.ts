import type Stripe from "stripe";

type CourseAttempt = {
  checkout_kind: string;
  organization_id: string;
  user_id: string;
  course_id: string | null;
  stripe_account_id: string | null;
  expected_amount_total: number | null;
  expected_currency: string;
};

export function validateCourseCheckoutSession({
  session,
  attempt,
  connectedAccountId,
}: {
  session: Stripe.Checkout.Session;
  attempt: CourseAttempt;
  connectedAccountId: string;
}): string | null {
  if (attempt.checkout_kind !== "course_purchase" || !attempt.course_id) {
    return "El Checkout no corresponde a una compra de curso.";
  }
  if (
    !attempt.stripe_account_id ||
    attempt.stripe_account_id !== connectedAccountId
  ) {
    return "La cuenta conectada no coincide con el intento de pago.";
  }
  if (session.mode !== "payment" || session.status !== "complete") {
    return "La sesión de compra no está completada.";
  }
  if (session.payment_status !== "paid") {
    return "La compra todavía no está pagada.";
  }
  if (
    session.currency?.toLowerCase() !== attempt.expected_currency.toLowerCase()
  ) {
    return "La moneda cobrada no coincide con la esperada.";
  }
  if (
    attempt.expected_amount_total === null ||
    session.amount_total !== attempt.expected_amount_total
  ) {
    return "El importe cobrado no coincide con el esperado.";
  }
  if (
    session.client_reference_id !== attempt.user_id ||
    session.metadata?.user_id !== attempt.user_id ||
    session.metadata?.course_id !== attempt.course_id ||
    session.metadata?.organization_id !== attempt.organization_id
  ) {
    return "La identidad o el curso del pago no coinciden con el intento.";
  }

  return null;
}

export function validatePlatformCheckoutSession({
  session,
  attempt,
}: {
  session: Stripe.Checkout.Session;
  attempt: Pick<
    CourseAttempt,
    "checkout_kind" | "organization_id" | "user_id" | "expected_currency"
  >;
}): string | null {
  if (attempt.checkout_kind !== "platform_subscription") {
    return "El Checkout no corresponde a una suscripción de plataforma.";
  }
  if (session.mode !== "subscription" || session.status !== "complete") {
    return "La sesión de suscripción no está completada.";
  }
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) {
    return "La suscripción todavía no ha completado su pago o prueba.";
  }
  if (
    session.currency?.toLowerCase() !== attempt.expected_currency.toLowerCase()
  ) {
    return "La moneda de la suscripción no coincide con la esperada.";
  }
  if (
    session.client_reference_id !== attempt.user_id ||
    session.metadata?.user_id !== attempt.user_id ||
    session.metadata?.organization_id !== attempt.organization_id
  ) {
    return "La empresa o el propietario no coinciden con el intento.";
  }

  return null;
}
