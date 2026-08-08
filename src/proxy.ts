import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

/**
 * Enrutamiento por RUTA en vez de subdominio: /o/cliente1/cursos -> se
 * reescribe internamente a /cursos con x-org-slug="cliente1". Decisión del
 * usuario (2026-08-07): sin dominio propio, *.vercel.app no admite
 * subdominios de cliente reales, así que esta es la forma real de dar a
 * cada organización su propia zona en producción hoy.
 */
const ORG_PATH_PREFIX = /^\/o\/([a-z0-9-]+)(\/.*)?$/;

/**
 * Extrae el slug de organización del subdominio (cliente1.aularia.app ->
 * "cliente1"). El dominio raíz (aularia.app, sin subdominio) es la web de
 * marketing/registro de nuevos clientes, no un tenant — devuelve null ahí.
 * Soporta cliente1.localhost:3000 en desarrollo.
 *
 * *.vercel.app (dominio de producción actual, aularia.vercel.app, y
 * cualquier URL de preview/deployment de Vercel) NUNCA se trata como
 * subdominio de cliente: Vercel no deja reclamar wildcards sobre su propio
 * dominio, así que mientras no haya un dominio propio los clientes se sirven
 * por ruta (/o/<slug>, ver ORG_PATH_PREFIX más abajo) y el dominio raíz es la
 * landing de registro de Aularia (sin organización resuelta, ver
 * getCurrentOrganization.ts). Sin este caso especial, "aularia.vercel.app"
 * se parsearía igual que "cliente1.aularia.app" y trataría "aularia" como si
 * fuera el slug de un cliente inexistente, rompiendo el sitio entero.
 */
function resolveOrgSlug(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) {
    return null;
  }

  const parts = hostname.split(".");
  const isLocalhost = parts[parts.length - 1] === "localhost";
  const minLabels = isLocalhost ? 2 : 3;
  if (parts.length < minLabels) return null;

  const subdomain = parts[0];
  return RESERVED_SUBDOMAINS.has(subdomain) ? null : subdomain;
}

export async function proxy(request: NextRequest) {
  const pathMatch = request.nextUrl.pathname.match(ORG_PATH_PREFIX);

  if (pathMatch) {
    const [, orgSlug, rest] = pathMatch;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-org-slug", orgSlug);
    requestHeaders.set("x-org-path-prefix", `/o/${orgSlug}`);

    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = rest || "/";

    return updateSession(request, () =>
      NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } })
    );
  }

  const orgSlug = resolveOrgSlug(request.headers.get("host"));
  if (orgSlug) {
    request.headers.set("x-org-slug", orgSlug);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
