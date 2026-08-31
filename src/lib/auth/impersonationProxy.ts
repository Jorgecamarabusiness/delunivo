import type { Session, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createImpersonationExitProof,
  getAuthSessionId,
  hashImpersonationToken,
} from "./impersonationCrypto";
import { IMPERSONATION_COOKIE } from "./impersonation";

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export async function enforceImpersonationSession(params: {
  request: NextRequest;
  response: NextResponse;
  user: User | null;
  session: Session | null;
}) {
  const { request, response, user, session } = params;
  if (
    request.nextUrl.pathname === "/api/support/run-as/exit" ||
    !user ||
    !session
  ) {
    return response;
  }

  const authSessionId = getAuthSessionId(session.access_token);
  const marker = request.cookies.get(IMPERSONATION_COOKIE)?.value ?? null;
  const admin = createAdminClient();

  const { data: supportSession } = authSessionId
    ? await admin
        .from("support_impersonation_sessions")
        .select("id, target_user_id, token_hash, status, expires_at")
        .eq("target_auth_session_id", authSessionId)
        .maybeSingle()
    : { data: null };

  if (!supportSession) {
    // Cookie antigua tras una restauración correcta: no afecta a una sesión
    // normal y se elimina para que el banner no reaparezca.
    if (marker) response.cookies.delete(IMPERSONATION_COOKIE);
    return response;
  }

  const valid =
    supportSession.target_user_id === user.id &&
    supportSession.status === "active" &&
    new Date(supportSession.expires_at).getTime() > Date.now() &&
    Boolean(marker) &&
    supportSession.token_hash === hashImpersonationToken(marker!);
  if (valid) return response;

  const exitUrl = new URL("/api/support/run-as/exit", request.url);
  exitUrl.searchParams.set("session", supportSession.id);
  exitUrl.searchParams.set(
    "proof",
    createImpersonationExitProof(supportSession.id, authSessionId!)
  );
  return redirectWithCookies(exitUrl, response);
}
