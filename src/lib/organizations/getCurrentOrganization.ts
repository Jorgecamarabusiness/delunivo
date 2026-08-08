import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  taglineTemplate: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  ownerName: string | null;
};

/**
 * Organización del sitio público que se está viendo, resuelta por el
 * subdominio o por la ruta /o/<slug> (header "x-org-slug" que inyecta
 * src/proxy.ts en cualquiera de los dos casos). Sin slug (dominio raíz, o
 * rutas globales como /login fuera de /o/<slug>) devuelve null — desde la
 * Fase 6 el dominio raíz es la landing de Aularia, no la tienda de ningún
 * cliente en concreto (antes de la Fase 6 existía aquí un fallback por
 * `DEFAULT_ORG_SLUG`; se quitó al dejar de hacer falta).
 *
 * Memoizado por request con cache() de React: Header, Footer, layout raíz y
 * cada página lo llaman de forma independiente sin repetir las queries.
 */
export const getCurrentOrganization = cache(
  async (): Promise<CurrentOrganization | null> => {
    const supabase = await createClient();
    const headerList = await headers();
    const slug = headerList.get("x-org-slug");

    if (!slug) return null;

    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const orgId = data?.id ?? null;

    if (!orgId) return null;

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, tagline_template, logo_url, primary_color, owner_id")
      .eq("id", orgId)
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
