import type { MetadataRoute } from "next";

const SITE_URL = "https://www.delunivo.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/perfil",
        "/login",
        "/register",
        "/verificar",
        "/forgot-password",
        "/reset-password",
        "/invitaciones/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
