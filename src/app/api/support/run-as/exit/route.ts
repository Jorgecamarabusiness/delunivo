import { NextResponse, type NextRequest } from "next/server";
import { restoreActorSession } from "@/lib/auth/restoreImpersonation";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthSessionId,
  verifyImpersonationExitProof,
} from "@/lib/auth/impersonationCrypto";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session");
  const proof = request.nextUrl.searchParams.get("proof");
  try {
    const { data } = await (await createClient()).auth.getSession();
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
    await restoreActorSession({
      sessionId,
      requestedStatus: "expired",
      reason: "Cierre automático por caducidad o sesión no válida",
    });
    return NextResponse.redirect(new URL("/admin/plataforma?runAs=ended", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?runAs=error", request.url));
  }
}
