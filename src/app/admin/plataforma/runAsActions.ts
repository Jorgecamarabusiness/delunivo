"use server";

import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import {
  encryptActorSession,
  getAuthSessionId,
  hashImpersonationToken,
} from "@/lib/auth/impersonationCrypto";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_DURATION_SECONDS,
} from "@/lib/auth/impersonation";
import { restoreActorSession } from "@/lib/auth/restoreImpersonation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

function requestIp(headerStore: Headers) {
  const value =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip")?.trim() ??
    "";
  return isIP(value) ? value : null;
}

export async function startRunAsAction(formData: FormData): Promise<ActionResult> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!targetUserId || reason.length < 5 || reason.length > 500) {
    return { error: "Indica un motivo de soporte de entre 5 y 500 caracteres." };
  }

  const supabase = await createClient();
  const [{ error: authError }, { data: auth }, { data: actorSession }] =
    await Promise.all([
      requireSuperAdmin(supabase),
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
  const actor = auth.user;
  if (authError || !actor || !actorSession.session) {
    return { error: authError ?? "No se pudo leer tu sesión." };
  }
  if (actor.id === targetUserId) {
    return { error: "No puedes ejecutar Run as sobre tu propia cuenta." };
  }

  const admin = createAdminClient();
  const [{ data: targetProfile }, { data: targetAuth }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, email, is_super_admin")
      .eq("id", targetUserId)
      .maybeSingle(),
    admin.auth.admin.getUserById(targetUserId),
  ]);
  const targetEmail = targetAuth.user?.email ?? targetProfile?.email ?? null;
  if (!targetProfile || !targetEmail) return { error: "No se encontró el usuario." };
  if (targetProfile.is_super_admin) {
    return { error: "No se puede ejecutar Run as sobre otro superadministrador." };
  }

  let encryptedActorSession: string;
  try {
    encryptedActorSession = encryptActorSession({
      accessToken: actorSession.session.access_token,
      refreshToken: actorSession.session.refresh_token,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cifrar la sesión." };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashImpersonationToken(rawToken);
  const expiresAt = new Date(
    Date.now() + IMPERSONATION_DURATION_SECONDS * 1000 - 2_000
  );
  const headerStore = await headers();
  const { data: auditId, error: auditError } = await admin.rpc(
    "start_support_impersonation_audit",
    {
      p_actor_user_id: actor.id,
      p_target_user_id: targetUserId,
      p_token_hash: tokenHash,
      p_encrypted_actor_session: encryptedActorSession,
      p_reason: reason,
      p_expires_at: expiresAt.toISOString(),
      p_ip_address: requestIp(headerStore),
      p_user_agent: headerStore.get("user-agent")?.slice(0, 1000) ?? null,
    }
  );
  if (auditError || !auditId) {
    return {
      error:
        auditError?.code === "23505"
          ? "Ya tienes una sesión Run as activa. Ciérrala antes de iniciar otra."
          : auditError?.message ?? "No se pudo abrir la sesión de soporte.",
    };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
  });
  const otpHash = link?.properties?.hashed_token;
  if (linkError || !otpHash) {
    await admin.rpc("close_support_impersonation_audit", {
      p_token_hash: tokenHash,
      p_status: "revoked",
      p_ended_by: actor.id,
      p_end_reason: "No se pudo generar la sesión objetivo",
    });
    return { error: "No se pudo generar la sesión temporal del usuario." };
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: otpHash,
    type: "magiclink",
  });
  const { data: targetSession } = await supabase.auth.getSession();
  const targetAuthSessionId = targetSession.session
    ? getAuthSessionId(targetSession.session.access_token)
    : null;
  if (verifyError || !targetSession.session || !targetAuthSessionId) {
    await supabase.auth.setSession({
      access_token: actorSession.session.access_token,
      refresh_token: actorSession.session.refresh_token,
    });
    await admin.rpc("close_support_impersonation_audit", {
      p_token_hash: tokenHash,
      p_status: "revoked",
      p_ended_by: actor.id,
      p_end_reason: "No se pudo canjear la sesión objetivo",
    });
    return { error: "No se pudo iniciar la sesión temporal del usuario." };
  }

  const { data: bound, error: bindError } = await admin.rpc(
    "bind_support_impersonation_auth_session",
    {
      p_token_hash: tokenHash,
      p_target_auth_session_id: targetAuthSessionId,
      p_target_user_id: targetUserId,
    }
  );
  if (bindError || !bound) {
    await supabase.auth.setSession({
      access_token: actorSession.session.access_token,
      refresh_token: actorSession.session.refresh_token,
    });
    await admin.auth.admin.signOut(targetSession.session.access_token, "local");
    await admin.rpc("close_support_impersonation_audit", {
      p_token_hash: tokenHash,
      p_status: "revoked",
      p_ended_by: actor.id,
      p_end_reason: "No se pudo vincular la sesión objetivo",
    });
    return { error: "No se pudo vincular la sesión temporal de forma segura." };
  }

  (await cookies()).set(IMPERSONATION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_DURATION_SECONDS,
    priority: "high",
  });

  const { count: adminMemberships } = await admin
    .from("organization_admins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetUserId);
  redirect(adminMemberships ? "/admin" : "/perfil");
}

export async function stopRunAsAction() {
  await restoreActorSession({ requestedStatus: "ended", reason: "Salida manual" });
  redirect("/admin/plataforma");
}
