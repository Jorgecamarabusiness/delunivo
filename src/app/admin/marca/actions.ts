"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { validateOrganizationSlug } from "@/lib/organizations/slug";
import type { ActionResult } from "@/types";

export type SlugAvailabilityResult = {
  status: "available" | "current" | "taken" | "invalid" | "error";
  slug: string;
  message: string;
};

export async function checkSlugAvailabilityAction(
  value: string
): Promise<SlugAvailabilityResult> {
  const validation = validateOrganizationSlug(value);
  if (!validation.ok) {
    return { status: "invalid", slug: validation.slug, message: validation.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", slug: validation.slug, message: "Debes iniciar sesión." };
  }

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) {
    return { status: "error", slug: validation.slug, message: "No perteneces a ninguna empresa." };
  }

  const adminCheck = await requireOrgAdmin(supabase, {
    organizationId: membership.organizationId,
  });
  if (adminCheck.error) {
    return { status: "error", slug: validation.slug, message: adminCheck.error };
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", validation.slug)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      slug: validation.slug,
      message: "No se pudo comprobar el enlace. Inténtalo de nuevo.",
    };
  }

  if (organization?.id === membership.organizationId) {
    return { status: "current", slug: validation.slug, message: "Este es tu enlace actual." };
  }

  if (organization) {
    return { status: "taken", slug: validation.slug, message: "Ese enlace ya está ocupado." };
  }

  return { status: "available", slug: validation.slug, message: "Este enlace está libre." };
}

export async function updateBrandingAction(
  formData: FormData
): Promise<ActionResult & { slug?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const slugValidation = validateOrganizationSlug(
    String(formData.get("slug") ?? "")
  );
  const taglineTemplate = String(formData.get("taglineTemplate") ?? "").trim();
  const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim();
  const featuredCourseId = String(formData.get("featuredCourseId") ?? "").trim();
  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!name) {
    return { error: "El nombre no puede estar vacío." };
  }

  if (!slugValidation.ok) {
    return { error: slugValidation.error };
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
      slug: slugValidation.slug,
      tagline_template: taglineTemplate || null,
      hero_subtitle: heroSubtitle || null,
      featured_course_id: featuredCourseId || null,
      primary_color: primaryColor || null,
      logo_url: logoUrl || null,
    })
    .eq("id", membership.organizationId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese enlace acaba de ser ocupado. Elige otro nombre." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { error: null, slug: slugValidation.slug };
}
