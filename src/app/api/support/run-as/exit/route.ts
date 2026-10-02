import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isChunkLike } from "@supabase/ssr";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import { restoreActorSession } from "@/lib/auth/restoreImpersonation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthSessionId,
  verifyImpersonationExitProof,
} from "@/lib/auth/impersonationCrypto";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session");
  const proof = request.nextUrl.searchParams.get("proof");
  const supabase = await createClient();
  try {
    const { data } = await supabase.auth.getSession();
    const authSessionId = data.session
      ? getAuthSessionId(data.session.access_token)
      : null;
    if (
      !sessionId ||
      !proof ||
      !authSessionId ||
      !verifyImpersonationExitProof(proof, sessionId, authSessionId)
    ) {
      return NextResponse.redirect(new URL("/login?runAs=invalid", request.url));
    }
  } catch {
    // No proof was established: do not change this browser's identity.
    return NextResponse.json({ error: "No se pudo verificar la salida de soporte." }, { status: 503 });
  }

  try {
    const restored = await restoreActorSession({
      sessionId,
      requestedStatus: "expired",
      reason: "Cierre automático por caducidad o sesión no válida",
    });
    if (restored) {
      return NextResponse.redirect(new URL("/admin/plataforma?runAs=ended", request.url));
    }
  } catch {
    // Cleanup can have erased the encrypted actor credentials, or the original
    // refresh token can have expired. Reauthentication must remain reachable.
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The browser must also recover when Auth is unavailable.
  }

  const response = NextResponse.redirect(new URL("/login?runAs=expired", request.url));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  const cookieStore = await cookies();
  const names = new Set([...request.cookies.getAll(), ...cookieStore.getAll()].map(cookie => cookie.name));
  for (const name of names) {
    if ([storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`].some(key => isChunkLike(name, key))) {
      // Explicit response expiry also covers malformed/chunked cookies and a
      // provider error before signOut could remove its local session.
      response.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
    }
  }
  response.cookies.delete(IMPERSONATION_COOKIE);
  return response;
}
