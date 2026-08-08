"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { getWhopMembershipByLicenseKey, isWhopMembershipValid } from "@/lib/whop/client";
import {
  getConnectedStripeAccountId,
  getWhopCredentials,
} from "@/lib/organizations/integrations";
import { orgPath } from "@/lib/organizations/orgPath";

type ActionResult = {
  error: string | null;
};

export async function redeemWhopLicenseAction(
  courseId: string,
  licenseKey: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const trimmed = licenseKey.trim();
  if (!trimmed) {
    return { error: "Introduce tu código de licencia de Whop." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("price, organization_id")
    .eq("id", courseId)
    .single();

  if (!course) {
    return { error: "Curso no encontrado." };
  }

  const admin = createAdminClient();

  const whopCredentials = await getWhopCredentials(admin, course.organization_id);
  if (!whopCredentials) {
    return { error: "Este curso no tiene Whop configurado todavía." };
  }

  const membership = await getWhopMembershipByLicenseKey(
    trimmed,
    whopCredentials.apiKey
  );

  if (!membership) {
    return { error: "No se encontró ninguna compra con ese código." };
  }

  if (!isWhopMembershipValid(membership, whopCredentials.productId)) {
    return { error: "Este código no es válido para este curso." };
  }

  const { error } = await admin.from("purchases").insert({
    user_id: user.id,
    course_id: courseId,
    organization_id: course.organization_id,
    amount_paid: course.price ?? 0,
    payment_method: "whop",
    external_reference: membership.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Este código ya ha sido utilizado o ya tienes acceso a este curso." };
    }
    return { error: error.message };
  }

  // Igual que en el webhook de Stripe: solo se añade al roster si todavía no
  // tenía ninguna fila — nunca se reactiva a alguien que fue expulsado.
  const { data: existingMembership } = await admin
    .from("organization_students")
    .select("id")
    .eq("organization_id", course.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await admin
      .from("organization_students")
      .insert({
        organization_id: course.organization_id,
        user_id: user.id,
        status: "active",
        joined_via: "purchase",
      });

    if (membershipError) {
      return { error: membershipError.message };
    }
  }

  revalidatePath(`/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}/aprender`);
  return { error: null };
}

export async function createStripeCheckoutAction(
  courseId: string
): Promise<ActionResult> {
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();

  // Si la organización ya conectó su propia cuenta de Stripe (Fase 5), el
  // dinero cae directo ahí y el evento "checkout.session.completed" llega al
  // webhook de Connect, no al de la cuenta principal. Si no, se mantiene el
  // comportamiento de siempre (cobra la cuenta principal de la plataforma) —
  // así no se rompe nada para organizaciones que todavía no se han conectado.
  const connectedAccountId = await getConnectedStripeAccountId(
    admin,
    course.organization_id
  );

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: course.title },
            unit_amount: Math.round(course.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}${await orgPath(`/cursos/${courseId}`)}?checkout=success`,
      cancel_url: `${siteUrl}${await orgPath(`/cursos/${courseId}`)}?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: { course_id: courseId, user_id: user.id },
    },
    connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
  );

  if (!session.url) {
    return { error: "No se pudo iniciar el pago con Stripe." };
  }

  redirect(session.url);
}
