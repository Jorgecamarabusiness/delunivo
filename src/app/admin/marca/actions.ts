"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";

type ActionResult = { error: string | null };

export async function updateBrandingAction(
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const taglineTemplate = String(formData.get("taglineTemplate") ?? "").trim();
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!name) {
    return { error: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) {
    return { error: "No perteneces a ninguna organización." };
  }

  const adminCheck = await requireOrgAdmin(supabase, {
    organizationId: membership.organizationId,
  });
  if (adminCheck.error) return adminCheck;

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      tagline_template: taglineTemplate || null,
      primary_color: primaryColor || null,
      logo_url: logoUrl || null,
    })
    .eq("id", membership.organizationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { error: null };
}
