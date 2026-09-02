import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { enforceImpersonationSession } from "@/lib/auth/impersonationProxy";

/**
 * Enrutamiento multi-tenant POR RUTA, y solo por ruta.
 *
 * `/o/cliente1/cursos` se reescribe internamente a `/cursos` con el header
 * `x-org-slug = "cliente1"`, mientras el navegador sigue viendo la URL con
 * prefijo. El dominio raíz (sin `/o/<slug>`) es la landing de Delunivo, no la
 * tienda de ningún cliente.
 *
 * Antes convivía además una resolución por subdominio (`cliente1.delunivo.app`).
 * Se eliminó a propósito: solo funcionaba en local con `*.localhost`, porque
 * Vercel no permite reclamar wildcards sobre `*.vercel.app`, así que producía
 * un comportamiento distinto en local y en producción — justo lo que no se
 * quiere. Con rutas, localhost y Vercel se comportan igual. Si algún día hay
 * dominio propio, se puede volver a añadir sin tocar nada más: todo lo demás
 * consume el header `x-org-slug`, no la URL.
 */
const ORG_PATH_PREFIX = /^\/o\/([a-z0-9-]+)(\/.*)?$/;

async function organizationExists(slug: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail open on configuration or network errors: the page still performs the
  // authoritative lookup and can render its normal error boundary. A transient
  // dependency failure must not turn a real customer portal into a false 404.
  if (!supabaseUrl || !anonKey) return true;

  try {
    const query = new URL("/rest/v1/organizations", supabaseUrl);
    query.searchParams.set("slug", `eq.${slug}`);
    query.searchParams.set("select", "id");
    query.searchParams.set("limit", "1");

    const response = await fetch(query, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return true;

    const rows = (await response.json()) as Array<{ id: string }>;
    return rows.length > 0;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const pathMatch = request.nextUrl.pathname.match(ORG_PATH_PREFIX);

  if (!pathMatch) {
    const auth = await updateSession(request);
    return enforceImpersonationSession({ request, ...auth });
  }

  const [, orgSlug, rest] = pathMatch;

  // `notFound()` inside the streamed root page can only add `noindex`; once
  // headers have been sent Next.js must keep HTTP 200. Resolve the lightweight
  // existence check here so unknown tenants have a real 404 status as well.
  if (!(await organizationExists(orgSlug))) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = "/__tenant-not-found";
    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-org-slug", orgSlug);
  requestHeaders.set("x-org-path-prefix", `/o/${orgSlug}`);

  const rewrittenUrl = request.nextUrl.clone();
  rewrittenUrl.pathname = rest || "/";

  const auth = await updateSession(request, () =>
    NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } })
  );
  return enforceImpersonationSession({ request, ...auth });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
