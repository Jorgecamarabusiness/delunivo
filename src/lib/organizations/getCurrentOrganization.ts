import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SellerLegalInfo } from "./sellerLegal";

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
  sellerLegal: SellerLegalInfo;
};

/**
 * Empresa cuyo portal se está viendo, resuelta por la ruta `/o/<slug>` (header
 * `x-org-slug` que inyecta src/proxy.ts). Sin slug — dominio raíz, o rutas
 * globales como /admin — devuelve null: el dominio raíz es la landing de
 * Delunivo, no la tienda de ningún cliente.
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
        "id, name, slug, tagline_template, hero_subtitle, featured_course_id, logo_url, primary_color, owner_id, seller_legal_name, seller_tax_id, seller_address, seller_contact_email, seller_country"
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
      sellerLegal: {
        seller_legal_name: org.seller_legal_name,
        seller_tax_id: org.seller_tax_id,
        seller_address: org.seller_address,
        seller_contact_email: org.seller_contact_email,
        seller_country: org.seller_country,
      },
    };
  }
);

/** Sustituye {admin} sin inventar alumnos ni resultados en la plantilla por defecto. */
export function renderTagline(organization: CurrentOrganization): string {
  const adminName = organization.ownerName ?? organization.name;
  if (organization.taglineTemplate) {
    return organization.taglineTemplate.includes("{admin}")
      ? organization.taglineTemplate.replace("{admin}", adminName)
      : organization.taglineTemplate;
  }
  return `Aprende a tu ritmo con ${adminName}`;
}
