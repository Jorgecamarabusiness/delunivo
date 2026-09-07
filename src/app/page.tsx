import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization, renderTagline } from "@/lib/organizations/getCurrentOrganization";
import { DelunivoLanding } from "./DelunivoLanding";
import { OrganizationLanding } from "./OrganizationLanding";
import { isAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getPlatformPriceCents } from "@/lib/billing/platform";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";
import { metadataDescription, organizationPath } from "@/lib/seo/publicUrls";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        url: "/",
        title: PLATFORM_NAME,
        description: PLATFORM_DESCRIPTION,
        siteName: PLATFORM_NAME,
      },
    };
  }

  const canonical = organizationPath(organization.slug);
  const description =
    metadataDescription(organization.heroSubtitle, renderTagline(organization)) ??
    `Cursos online de ${organization.name}.`;

  return {
    title: organization.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: organization.name,
      description,
      siteName: organization.name,
      ...(organization.logoUrl
        ? { images: [{ url: organization.logoUrl, alt: `Logo de ${organization.name}` }] }
        : {}),
    },
  };
}

/**
 * Esta misma ruta atiende el dominio raíz (la web de Delunivo) y `/o/<slug>`
 * (el portal de esa empresa, tras el rewrite de src/proxy.ts) — de ahí la rama
 * según si hay organización resuelta.
 */
export default async function Home() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    organization,
  ] = await Promise.all([supabase.auth.getUser(), getCurrentOrganization()]);

  if (!organization) {
    if ((await headers()).get("x-org-slug")) notFound();

    const [isAdmin, priceCents] = await Promise.all([
      user ? isAnyOrgAdmin(supabase, user.id) : false,
      getPlatformPriceCents(),
    ]);
    return <DelunivoLanding isAdmin={isAdmin} priceCents={priceCents} />;
  }

  return (
    <OrganizationLanding
      organization={organization}
      isLoggedIn={Boolean(user)}
    />
  );
}
