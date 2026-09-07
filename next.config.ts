import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self' https://checkout.stripe.com; upgrade-insecure-requests",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }, {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }, ...[
      "/admin/:path*", "/perfil/:path*", "/login", "/register", "/forgot-password", "/reset-password", "/verificar", "/invitaciones/:path*",
      "/cursos/:id/aprender/:path*", "/o/:slug/admin/:path*", "/o/:slug/perfil/:path*", "/o/:slug/cursos/:id/aprender/:path*",
      "/o/:slug/login", "/o/:slug/register", "/o/:slug/forgot-password", "/o/:slug/reset-password", "/o/:slug/verificar", "/o/:slug/invitaciones/:path*",
    ].map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }))];

  },
};

export default nextConfig;
