import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Enrutamiento multi-tenant POR RUTA, y solo por ruta.
 *
 * `/o/cliente1/cursos` se reescribe internamente a `/cursos` con el header
 * `x-org-slug = "cliente1"`, mientras el navegador sigue viendo la URL con
 * prefijo. El dominio raíz (sin `/o/<slug>`) es la landing de Aularia, no la
 * tienda de ningún cliente.
 *
 * Antes convivía además una resolución por subdominio (`cliente1.aularia.app`).
 * Se eliminó a propósito: solo funcionaba en local con `*.localhost`, porque
 * Vercel no permite reclamar wildcards sobre `*.vercel.app`, así que producía
 * un comportamiento distinto en local y en producción — justo lo que no se
 * quiere. Con rutas, localhost y Vercel se comportan igual. Si algún día hay
 * dominio propio, se puede volver a añadir sin tocar nada más: todo lo demás
 * consume el header `x-org-slug`, no la URL.
 */
const ORG_PATH_PREFIX = /^\/o\/([a-z0-9-]+)(\/.*)?$/;

export async function proxy(request: NextRequest) {
  const pathMatch = request.nextUrl.pathname.match(ORG_PATH_PREFIX);

  if (!pathMatch) {
    return updateSession(request);
  }

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
