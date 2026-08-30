import { createClient } from "@/lib/supabase/server";

export type OrgMembership = {
  organizationId: string;
  role: "owner" | "admin";
};

/**
 * Organización activa del admin. Si administra varias, prioriza la primera
 * con acceso comercial vigente y conserva la más antigua como fallback para
 * que pueda entrar en facturación y reactivarla.
 */
export async function getCurrentOrgMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMembership | null> {
  const { data } = await supabase
    .from("organization_admins")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!data?.length) return null;

  let selected = data[0];
  for (const membership of data) {
    const { data: hasPlatformAccess } = await supabase.rpc(
      "has_org_platform_access",
      { org_id: membership.organization_id }
    );
    if (hasPlatformAccess) {
      selected = membership;
      break;
    }
  }

  return {
    organizationId: selected.organization_id,
    role: selected.role === "owner" ? "owner" : "admin",
  };
}
