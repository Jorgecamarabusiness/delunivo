"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { requireOrgOwner } from "@/lib/auth/requireOrgAdmin";
import { stripe } from "@/lib/stripe/client";
import { encrypt } from "@/lib/crypto/encryption";

type ActionResult = { error: string | null };

export async function connectStripeAction() {
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

  const { data: existing } = await supabase
    .from("organization_integrations")
    .select("stripe_account_id")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;

  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;

    const { error } = await supabase.from("organization_integrations").upsert(
      {
        organization_id: membership.organizationId,
        stripe_account_id: accountId,
        stripe_connect_status: "pending",
      },
      { onConflict: "organization_id" }
    );
    if (error) throw new Error(error.message);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl}/admin/configuracion?stripe=refresh`,
    return_url: `${siteUrl}/admin/configuracion?stripe=return`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}

export async function saveWhopCredentialsAction(
  formData: FormData
): Promise<ActionResult> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();

  if (!apiKey || !productId) {
    return { error: "Introduce la API key y el ID de producto de Whop." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para hacer esto." };

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) return { error: "No perteneces a ninguna organización." };

  const ownerCheck = await requireOrgOwner(supabase, {
    organizationId: membership.organizationId,
  });
  if (ownerCheck.error) return ownerCheck;

  const { error } = await supabase.from("organization_integrations").upsert(
    {
      organization_id: membership.organizationId,
      whop_api_key_encrypted: encrypt(apiKey),
      whop_product_id: productId,
    },
    { onConflict: "organization_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/configuracion");
  return { error: null };
}
