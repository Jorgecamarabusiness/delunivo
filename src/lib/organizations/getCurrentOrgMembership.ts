import { createClient } from "@/lib/supabase/server";

export type OrgMembership = {
  organizationId: string;
  role: "owner" | "admin";
};

/** Organización "activa" del admin logueado — si es co-admin de varias, la más antigua. */
export async function getCurrentOrgMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<OrgMembership | null> {
  const { data } = await supabase
    .from("organization_admins")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    organizationId: data.organization_id,
    role: data.role === "owner" ? "owner" : "admin",
  };
}
