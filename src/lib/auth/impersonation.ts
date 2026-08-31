import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashImpersonationToken } from "./impersonationCrypto";

export const IMPERSONATION_COOKIE = "delunivo_run_as";
export const IMPERSONATION_DURATION_SECONDS = 15 * 60;

export type ActiveImpersonation = {
  id: string;
  actorUserId: string;
  targetUserId: string;
  expiresAt: string;
  actorName: string;
  targetName: string;
};

export async function getActiveImpersonationForUser(
  userId: string
): Promise<ActiveImpersonation | null> {
  const token = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("support_impersonation_sessions")
    .select("id, actor_user_id, target_user_id, expires_at, status")
    .eq("token_hash", hashImpersonationToken(token))
    .maybeSingle();

  if (
    !session ||
    session.status !== "active" ||
    session.target_user_id !== userId ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email")
    .in("id", [session.actor_user_id, session.target_user_id]);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return {
    id: session.id,
    actorUserId: session.actor_user_id,
    targetUserId: session.target_user_id,
    expiresAt: session.expires_at,
    actorName:
      byId.get(session.actor_user_id)?.name ??
      byId.get(session.actor_user_id)?.email ??
      "Superadministrador",
    targetName:
      byId.get(session.target_user_id)?.name ??
      byId.get(session.target_user_id)?.email ??
      "Usuario",
  };
}

export async function rejectSensitiveActionDuringImpersonation(userId: string) {
  const active = await getActiveImpersonationForUser(userId);
  return active
    ? "Esta acción sensible está bloqueada durante Run as. Sal del modo soporte para continuar."
    : null;
}
