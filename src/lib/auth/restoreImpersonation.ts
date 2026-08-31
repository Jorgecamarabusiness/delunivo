import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  decryptActorSession,
  hashImpersonationToken,
} from "./impersonationCrypto";
import { IMPERSONATION_COOKIE } from "./impersonation";

export async function restoreActorSession(options: {
  sessionId?: string | null;
  requestedStatus?: "ended" | "expired";
  reason?: string;
} = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  const admin = createAdminClient();
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: currentAuth },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  let query = admin
    .from("support_impersonation_sessions")
    .select(
      "id, actor_user_id, target_user_id, token_hash, encrypted_actor_session, status, expires_at"
    );
  if (options.sessionId) query = query.eq("id", options.sessionId);
  else if (token) query = query.eq("token_hash", hashImpersonationToken(token));
  else return false;

  const { data: audit } = await query.maybeSingle();
  if (!audit || !user) {
    cookieStore.delete(IMPERSONATION_COOKIE);
    return false;
  }
  if (user.id !== audit.target_user_id && user.id !== audit.actor_user_id) {
    throw new Error("La sesión actual no pertenece a este Run as.");
  }

  if (user.id === audit.target_user_id) {
    const actorSession = decryptActorSession(audit.encrypted_actor_session);
    const targetAccessToken = currentAuth.session?.access_token ?? null;
    const { error: restoreError } = await supabase.auth.setSession({
      access_token: actorSession.accessToken,
      refresh_token: actorSession.refreshToken,
    });
    if (restoreError) {
      throw new Error("No se pudo restaurar la sesión del superadministrador.");
    }
    if (targetAccessToken) {
      await admin.auth.admin.signOut(targetAccessToken, "local");
    }
  }

  if (audit.status === "active") {
    const expired = new Date(audit.expires_at).getTime() <= Date.now();
    const status = expired ? "expired" : (options.requestedStatus ?? "ended");
    const { error } = await admin.rpc("close_support_impersonation_audit", {
      p_token_hash: audit.token_hash,
      p_status: status,
      p_ended_by: user.id,
      p_end_reason:
        options.reason ??
        (status === "expired" ? "La sesión de soporte caducó" : "Salida manual"),
    });
    if (error) throw new Error(error.message);
  }

  cookieStore.delete(IMPERSONATION_COOKIE);
  return true;
}
