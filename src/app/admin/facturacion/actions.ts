"use server";

import { redirect } from "next/navigation";
import { requireOwnerContext } from "@/lib/organizations/requireOwnerContext";
import { stripe } from "@/lib/stripe/client";
import { describeStripeError } from "@/lib/stripe/errors";
import { createPlatformSubscriptionCheckoutUrl } from "@/lib/stripe/platformSubscription";
import type { ActionResult } from "@/types";

// Ambas actions llevan la firma de `useActionState` (prevState, formData) para
// que el formulario pueda pintar el error en pantalla en vez de reventar.
export async function subscribeAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const auth = await requireOwnerContext({ allowInactive: true, organizationId });
  if (!auth.ok) return { error: auth.error };
  const { context } = auth;

  let checkoutUrl: string | null;
  try {
    checkoutUrl = await createPlatformSubscriptionCheckoutUrl(
      context.organizationId,
      context.userId
    );
  } catch (stripeError) {
    return { error: describeStripeError(stripeError) };
  }

  if (!checkoutUrl) {
    return { error: "No se pudo iniciar el pago con Stripe. Inténtalo de nuevo." };
  }

  // Fuera del try: redirect() lanza NEXT_REDIRECT a propósito y no debe
  // capturarse como si fuera un fallo de Stripe.
  redirect(checkoutUrl);
}

export async function openBillingPortalAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const auth = await requireOwnerContext({ allowInactive: true, organizationId });
  if (!auth.ok) return { error: auth.error };
  const { context } = auth;

  const { data: billing } = await context.supabase
    .from("organization_billing")
    .select("platform_stripe_customer_id")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  // Puede pasar de verdad: el estado de la suscripción se puede haber puesto a
  // 'active' a mano (seeds, pruebas) sin que ningún checkout real haya creado
  // el cliente en Stripe. Antes esto lanzaba y el owner veía la pantalla
  // genérica de error de Next.
  if (!billing?.platform_stripe_customer_id) {
    return {
      error:
        "No hay ninguna suscripción de Stripe asociada a esta empresa todavía. " +
        "Suscríbete primero y podrás gestionarla desde aquí.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let portalUrl: string;
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billing.platform_stripe_customer_id,
      return_url: `${siteUrl}/admin/facturacion?empresa=${context.organizationId}`,
    });
    portalUrl = portalSession.url;
  } catch (stripeError) {
    return { error: describeStripeError(stripeError) };
  }

  redirect(portalUrl);
}
