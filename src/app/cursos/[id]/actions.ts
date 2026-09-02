"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectedStripeAccountId } from "@/lib/organizations/integrations";
import { orgPath } from "@/lib/organizations/orgPath";
import {
  claimCheckoutAttempt,
  getCheckoutUrlForAttempt,
} from "@/lib/stripe/checkoutAttempts";
import { describeStripeError } from "@/lib/stripe/errors";

type ActionResult = {
  error: string | null;
};

export async function createStripeCheckoutAction(
  courseId: string,
  acceptedDigitalContent: boolean
): Promise<ActionResult> {
  if (acceptedDigitalContent !== true) {
    return {
      error:
        "Debes aceptar el inicio inmediato del contenido digital antes de continuar.",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para comprar el curso." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price, organization_id")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Curso no encontrado." };
  }

  const [accessResult, purchaseResult] = await Promise.all([
    supabase.rpc("has_course_access", { target_course_id: course.id }),
    supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle(),
  ]);
  if (accessResult.error || purchaseResult.error) {
    return { error: "No se pudo comprobar tu acceso antes de cobrar." };
  }
  if (purchaseResult.data) {
    return {
      error:
        "Este curso ya fue comprado con esta cuenta. Si no puedes entrar, contacta con el profesor; no se ha realizado ningún cobro nuevo.",
    };
  }
  if (accessResult.data) {
    return { error: "Ya tienes acceso a este curso; no se ha realizado ningún cobro." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  const connectedAccountId = await getConnectedStripeAccountId(
    admin,
    course.organization_id
  );
  if (!connectedAccountId) {
    return {
      error:
        "El profesor todavía no ha terminado de conectar Stripe. No se ha realizado ningún cobro.",
    };
  }

  const amountTotal = Math.round(Number(course.price) * 100);
  if (!Number.isInteger(amountTotal) || amountTotal < 50) {
    return { error: "El precio del curso no es válido para cobrar con Stripe." };
  }

  const coursePath = await orgPath(`/cursos/${courseId}`);
  const stripeParams = {
    mode: "payment" as const,
    payment_method_types: ["card" as const],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: course.title },
          unit_amount: amountTotal,
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}${coursePath}?checkout=success`,
    cancel_url: `${siteUrl}${coursePath}?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: {
      course_id: courseId,
      user_id: user.id,
      organization_id: course.organization_id,
      digital_content_consent: "true",
      terms_version: "2026-09-02",
    },
  };

  let checkoutUrl: string;
  try {
    const attempt = await claimCheckoutAttempt({
      checkoutKind: "course_purchase",
      organizationId: course.organization_id,
      userId: user.id,
      courseId,
      stripeAccountId: connectedAccountId,
      stripeParams,
      expectedAmountTotal: amountTotal,
      expectedCurrency: "eur",
    });
    checkoutUrl = await getCheckoutUrlForAttempt(attempt);
  } catch (error) {
    return { error: describeStripeError(error) };
  }

  redirect(checkoutUrl);
}
