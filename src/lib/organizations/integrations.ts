import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto/encryption";

/**
 * Lee `organization_integrations` con el cliente admin (service role): quien
 * llama a esto normalmente es un comprador/alumno, no el owner de la
 * organización, y la RLS de esa tabla solo deja leer al propio owner.
 */
export async function getConnectedStripeAccountId(
  admin: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await admin
    .from("organization_integrations")
    .select("stripe_account_id, stripe_connect_status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data?.stripe_account_id || data.stripe_connect_status !== "connected") {
    return null;
  }

  return data.stripe_account_id;
}

export async function getWhopCredentials(
  admin: SupabaseClient,
  organizationId: string
): Promise<{ apiKey: string; productId: string } | null> {
  const { data } = await admin
    .from("organization_integrations")
    .select("whop_api_key_encrypted, whop_product_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data?.whop_api_key_encrypted || !data.whop_product_id) {
    return null;
  }

  return {
    apiKey: decrypt(data.whop_api_key_encrypted),
    productId: data.whop_product_id,
  };
}
