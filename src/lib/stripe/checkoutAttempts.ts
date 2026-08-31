import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";

export type CheckoutAttemptKind = "course_purchase" | "platform_subscription";
export type CheckoutAttemptStatus =
  | "creating"
  | "open"
  | "completed"
  | "expired"
  | "failed";

export type CheckoutAttempt = {
  id: string;
  checkout_kind: CheckoutAttemptKind;
  organization_id: string;
  user_id: string;
  course_id: string | null;
  stripe_account_id: string | null;
  stripe_session_id: string | null;
  stripe_session_url: string | null;
  stripe_params: Stripe.Checkout.SessionCreateParams;
  expected_amount_total: number | null;
  expected_currency: string;
  status: CheckoutAttemptStatus;
  expires_at: string | null;
};

type ClaimCheckoutAttemptInput = {
  checkoutKind: CheckoutAttemptKind;
  organizationId: string;
  userId: string;
  courseId: string | null;
  stripeAccountId: string | null;
  stripeParams: Stripe.Checkout.SessionCreateParams;
  expectedAmountTotal: number | null;
  expectedCurrency?: string;
};

const ATTEMPT_COLUMNS = [
  "id",
  "checkout_kind",
  "organization_id",
  "user_id",
  "course_id",
  "stripe_account_id",
  "stripe_session_id",
  "stripe_session_url",
  "stripe_params",
  "expected_amount_total",
  "expected_currency",
  "status",
  "expires_at",
].join(", ");

async function findActiveAttempt(
  input: Pick<
    ClaimCheckoutAttemptInput,
    "checkoutKind" | "organizationId" | "userId" | "courseId"
  >
): Promise<CheckoutAttempt | null> {
  const admin = createAdminClient();
  let query = admin
    .from("stripe_checkout_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("checkout_kind", input.checkoutKind)
    .in("status", ["creating", "open"]);

  query =
    input.checkoutKind === "course_purchase"
      ? query.eq("user_id", input.userId).eq("course_id", input.courseId)
      : query.eq("organization_id", input.organizationId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error("No se pudo comprobar si ya había un pago en curso.");
  }

  return (data as CheckoutAttempt | null) ?? null;
}

export async function claimCheckoutAttempt(
  input: ClaimCheckoutAttemptInput
): Promise<CheckoutAttempt> {
  const existing = await findActiveAttempt(input);
  if (existing) {
    if (
      existing.status === "open" &&
      existing.expires_at &&
      new Date(existing.expires_at).getTime() <= Date.now()
    ) {
      const admin = createAdminClient();
      const { data: expiredAttempt, error: expiryError } = await admin
        .from("stripe_checkout_attempts")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();
      if (expiryError || !expiredAttempt) {
        throw new Error("No se pudo cerrar la sesión de pago caducada.");
      }
      return claimCheckoutAttempt(input);
    }

    return existing;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stripe_checkout_attempts")
    .insert({
      id: randomUUID(),
      checkout_kind: input.checkoutKind,
      organization_id: input.organizationId,
      user_id: input.userId,
      course_id: input.courseId,
      stripe_account_id: input.stripeAccountId,
      stripe_params: input.stripeParams,
      expected_amount_total: input.expectedAmountTotal,
      expected_currency: input.expectedCurrency ?? "eur",
      status: "creating",
    })
    .select(ATTEMPT_COLUMNS)
    .single();

  if (!error && data) {
    return data as unknown as CheckoutAttempt;
  }

  // Una petición concurrente pudo ganar el índice único parcial. En ese caso
  // ambas reutilizan el mismo intento y la misma clave idempotente de Stripe.
  if (error?.code === "23505") {
    const concurrentAttempt = await findActiveAttempt(input);
    if (concurrentAttempt) return concurrentAttempt;
  }

  throw new Error("No se pudo reservar un intento de pago seguro.");
}

export async function getCheckoutUrlForAttempt(
  attempt: CheckoutAttempt
): Promise<string> {
  if (
    attempt.status === "open" &&
    attempt.stripe_session_url &&
    (!attempt.expires_at || new Date(attempt.expires_at).getTime() > Date.now())
  ) {
    return attempt.stripe_session_url;
  }

  const requestOptions: Stripe.RequestOptions = {
    idempotencyKey: `delunivo-checkout-${attempt.id}`,
    ...(attempt.stripe_account_id
      ? { stripeAccount: attempt.stripe_account_id }
      : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create(
      attempt.stripe_params,
      requestOptions
    );

    if (!session.url) {
      throw new Error("Stripe no devolvió una URL de pago.");
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("stripe_checkout_attempts")
      .update({
        stripe_session_id: session.id,
        stripe_session_url: session.url,
        status: "open",
        expires_at: new Date(session.expires_at * 1_000).toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .in("status", ["creating", "open"]);

    if (error) {
      throw new Error("No se pudo guardar la sesión de pago de forma segura.");
    }

    return session.url;
  } catch (error) {
    // Se conserva el estado `creating`: un reintento utilizará el mismo ID y
    // la misma clave idempotente, incluso si la respuesta de Stripe se perdió.
    const admin = createAdminClient();
    await admin
      .from("stripe_checkout_attempts")
      .update({
        error_message:
          error instanceof Error ? error.message.slice(0, 1_000) : "Error de Stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    throw error;
  }
}

export async function markCheckoutAttemptCompleted(attemptId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_checkout_attempts")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", attemptId);

  if (error) {
    throw new Error("No se pudo cerrar el intento de pago.");
  }
}
