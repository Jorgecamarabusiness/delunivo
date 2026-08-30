import type { SupabaseClient } from "@supabase/supabase-js";

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
