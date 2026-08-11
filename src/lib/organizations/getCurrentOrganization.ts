import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  taglineTemplate: string | null;
  heroSubtitle: string | null;
  featuredCourseId: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  ownerName: string | null;
};

/**
 * Empresa cuyo portal se está viendo, resuelta por la ruta `/o/<slug>` (header
 * `x-org-slug` que inyecta src/proxy.ts). Sin slug — dominio raíz, o rutas
 * globales como /admin — devuelve null: el dominio raíz es la landing de
 * Aularia, no la tienda de ningún cliente.
 *
 * Memoizado por request con cache() de React: layout raíz, Header, Footer y la
 * página lo llaman por su cuenta sin repetir las queries.
 */
export const getCurrentOrganization = cache(
  async (): Promise<CurrentOrganization | null> => {
    const headerList = await headers();
    const slug = headerList.get("x-org-slug");

    if (!slug) return null;

    const supabase = await createClient();

    const { data: org } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, tagline_template, hero_subtitle, featured_course_id, logo_url, primary_color, owner_id"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (!org) return null;

    let ownerName: string | null = null;
    if (org.owner_id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", org.owner_id)
        .maybeSingle();
      ownerName = ownerProfile?.name ?? null;
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      taglineTemplate: org.tagline_template,
      heroSubtitle: org.hero_subtitle,
      featuredCourseId: org.featured_course_id,
      logoUrl: org.logo_url,
      primaryColor: org.primary_color,
      ownerName,
    };
  }
);

/** "Aprende {tema} junto a cientos de usuarios con {admin}" -> sustituye {admin}. Con plantilla vacía, usa un genérico. */
export function renderTagline(organization: CurrentOrganization): string {
  const adminName = organization.ownerName ?? organization.name;
  if (organization.taglineTemplate) {
    return organization.taglineTemplate.includes("{admin}")
      ? organization.taglineTemplate.replace("{admin}", adminName)
      : organization.taglineTemplate;
  }
  return `Aprende junto a cientos de usuarios con ${adminName}`;
}
