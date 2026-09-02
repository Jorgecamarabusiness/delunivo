import type { MetadataRoute } from "next";

const SITE_URL = "https://www.delunivo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/crear-empresa`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...["aviso-legal", "privacidad", "condiciones"].map((path) => ({
      url: `${SITE_URL}/${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
