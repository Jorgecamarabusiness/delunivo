import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/perfil",
        "/cuenta/",
        "/login",
        "/register",
        "/verificar",
        "/forgot-password",
        "/reset-password",
        "/invitaciones/",
        "/cursos/*/aprender",
        "/o/*/admin/",
        "/o/*/perfil",
        "/o/*/cuenta/",
        "/o/*/login",
        "/o/*/register",
        "/o/*/verificar",
        "/o/*/forgot-password",
        "/o/*/reset-password",
        "/o/*/invitaciones/",
        "/o/*/cursos/*/aprender",
      ],
    },
    sitemap: `${PLATFORM_URL}/sitemap.xml`,
    host: PLATFORM_URL,
  };
}
