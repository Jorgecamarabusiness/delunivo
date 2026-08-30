"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { getConnectedStripeAccountId } from "@/lib/organizations/integrations";
import { orgPath } from "@/lib/organizations/orgPath";

type ActionResult = {
  error: string | null;
};

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
