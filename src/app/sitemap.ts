import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/brand";
import { coursePath, organizationPath, platformUrl } from "@/lib/seo/publicUrls";
import { createClient } from "@/lib/supabase/server";

const platformEntries: MetadataRoute.Sitemap = [
    {
      url: PLATFORM_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: platformUrl("/crear-empresa"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...["aviso-legal", "privacidad", "condiciones"].map((path) => ({
      url: platformUrl(`/${path}`),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient();
    const [{ data: organizations }, { data: courses }] = await Promise.all([
      supabase.from("organizations").select("id, slug").limit(5000),
      supabase
        .from("courses")
        .select("id, organization_id")
        .eq("status", "published")
        .limit(10000),
    ]);

    const organizationSlugs = new Map(
      (organizations ?? [])
        .filter((organization) => Boolean(organization.id && organization.slug))
        .map((organization) => [organization.id, organization.slug])
    );
    const organizationEntries: MetadataRoute.Sitemap = Array.from(organizationSlugs.values()).map(
      (slug) => ({
        url: platformUrl(organizationPath(slug)),
        changeFrequency: "weekly",
        priority: 0.8,
      })
    );
    const courseEntries: MetadataRoute.Sitemap = (courses ?? []).flatMap((course) => {
      const slug = organizationSlugs.get(course.organization_id);
      return slug
        ? [{ url: platformUrl(coursePath(slug, course.id)), changeFrequency: "weekly" as const, priority: 0.7 }]
        : [];
    });

    return [...platformEntries, ...organizationEntries, ...courseEntries];
  } catch {
    // El catálogo no debe convertir sitemap.xml en un 500 si una lectura pública
    // está temporalmente indisponible.
    return platformEntries;
  }
}
