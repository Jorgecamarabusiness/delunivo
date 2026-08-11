"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import type { ActionResult } from "@/types";

export async function updateBrandingAction(
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const taglineTemplate = String(formData.get("taglineTemplate") ?? "").trim();
  const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim();
  const featuredCourseId = String(formData.get("featuredCourseId") ?? "").trim();
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
    return { error: "No perteneces a ninguna empresa." };
  }

  const adminCheck = await requireOrgAdmin(supabase, {
    organizationId: membership.organizationId,
  });
  if (adminCheck.error) return adminCheck;

  // El curso destacado tiene que ser de ESTA empresa: el desplegable ya solo
  // ofrece los suyos, pero el id llega en un formulario y se puede manipular.
  if (featuredCourseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", featuredCourseId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();

    if (!course) {
      return { error: "Ese curso no es de tu empresa." };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      tagline_template: taglineTemplate || null,
      hero_subtitle: heroSubtitle || null,
      featured_course_id: featuredCourseId || null,
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
