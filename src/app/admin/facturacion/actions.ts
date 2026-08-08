"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { requireOrgOwner } from "@/lib/auth/requireOrgAdmin";
import { stripe } from "@/lib/stripe/client";
import { createPlatformSubscriptionCheckoutUrl } from "@/lib/stripe/platformSubscription";

async function requireOwnerMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión para hacer esto.");

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) throw new Error("No perteneces a ninguna organización.");

  const ownerCheck = await requireOrgOwner(supabase, {
    organizationId: membership.organizationId,
  });
  if (ownerCheck.error) throw new Error(ownerCheck.error);

  return { userId: user.id, organizationId: membership.organizationId, supabase };
}

export async function subscribeAction() {
  const { userId, organizationId } = await requireOwnerMembership();

  const checkoutUrl = await createPlatformSubscriptionCheckoutUrl(
    organizationId,
    userId
  );

  if (!checkoutUrl) {
    throw new Error("No se pudo iniciar el pago con Stripe.");
  }

  redirect(checkoutUrl);
}

export async function openBillingPortalAction() {
  const { organizationId, supabase } = await requireOwnerMembership();

  const { data: billing } = await supabase
    .from("organization_billing")
    .select("platform_stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!billing?.platform_stripe_customer_id) {
    throw new Error("Todavía no tienes ninguna suscripción activa.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: billing.platform_stripe_customer_id,
    return_url: `${siteUrl}/admin/facturacion`,
  });

  redirect(portalSession.url);
}
