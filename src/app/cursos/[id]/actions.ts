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
import { settleOpenCheckouts } from "@/lib/stripe/settleOpenCheckouts";
import {
  freeCourseGrantMessage,
  isFreeCoursePrice,
  type FreeCourseGrantStatus,
} from "@/lib/courses/freeCourseAccess";

type ActionResult = {
  error: string | null;
};

export type FreeCourseActionResult = ActionResult & {
  granted: boolean;
};

const FREE_COURSE_GRANT_STATUSES = new Set<FreeCourseGrantStatus>([
  "granted",
  "already_has_access",
  "price_changed",
  "not_available",
  "removed",
  "revoked",
  "account_inactive",
  "checkout_pending",
]);

/**
 * Concede el acceso con el RPC atómico. La acción vuelve a comprobar sesión y
 * precio porque se puede invocar por POST sin pasar por la ficha del curso.
 */
export async function grantFreeCourseAccessAction(
  courseId: string
): Promise<FreeCourseActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { granted: false, error: "Debes iniciar sesión para acceder al curso." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, price, organization_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { granted: false, error: "Curso no encontrado." };
  }
  if (!isFreeCoursePrice(course.price)) {
    return {
      granted: false,
      error: "Este curso ya no es gratuito. Vuelve a la ficha para ver las opciones disponibles.",
    };
  }

  try { await settleOpenCheckouts(user.id, course.id); }
  catch { return { granted: false, error: "Hay un pago anterior pendiente de conciliación. Inténtalo de nuevo; todavía no se ha concedido otro acceso." }; }
  const { data, error } = await supabase.rpc("grant_free_course_access", {
    p_course_id: course.id,
    p_organization_id: course.organization_id,
  });

  if (error || typeof data !== "string" || !FREE_COURSE_GRANT_STATUSES.has(data as FreeCourseGrantStatus)) {
    return {
      granted: false,
      error: "No se pudo activar el acceso gratuito. Inténtalo de nuevo en unos minutos.",
    };
  }

  const status = data as FreeCourseGrantStatus;
  return {
    granted: status === "granted" || status === "already_has_access",
    error: freeCourseGrantMessage(status) || null,
  };
}

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
    .select("id, title, price, organization_id, status")
    .eq("id", courseId)
    .single();

  if (!course || course.status !== "published") {
    return { error: "Curso no encontrado." };
  }
  const roster = await supabase.from("organization_students").select("status").eq("organization_id", course.organization_id).eq("user_id", user.id).maybeSingle();
  if (roster.error || roster.data?.status === "removed") return { error: "No se puede abrir un pago para esta cuenta. Contacta con la escuela para revisar tu acceso." };

  // Un curso gratuito nunca debe requerir una cuenta Connect ni crear un intento
  // de checkout. El RPC de acceso gratuito vuelve a validar esta misma regla.
  if (isFreeCoursePrice(course.price)) {
    return {
      error: "Este curso es gratuito. Usa el botón de acceso gratuito de la ficha.",
    };
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
