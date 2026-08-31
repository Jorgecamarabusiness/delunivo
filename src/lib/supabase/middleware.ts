import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * buildResponse permite que el llamador use NextResponse.rewrite(...) en vez
 * del NextResponse.next() por defecto (necesario para el enrutamiento por
 * ruta /o/<slug>, ver src/proxy.ts) — se reconstruye con la misma factory
 * cada vez que Supabase necesita renovar cookies de sesión, para no perder
 * el rewrite.
 */
export async function updateSession(
  request: NextRequest,
  buildResponse: () => NextResponse = () => NextResponse.next({ request })
) {
  let supabaseResponse = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No eliminar: refresca el token de sesión llamando a getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();

  return { response: supabaseResponse, user, session: sessionData.session };
}
