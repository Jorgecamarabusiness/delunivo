"use server";
import { createHash, randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DELETION_COOKIE, getAccountDeletionPreview } from "@/lib/account-deletion/preview";
import { processAccountDeletionJobs } from "@/lib/account-deletion/worker";

export async function requestAccountDeletionAction(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  try { if (!origin || new URL(origin).host !== host) return { error: "La solicitud no procede de esta página. Recarga e inténtalo de nuevo." }; }
  catch { return { error: "Origen de solicitud no válido." }; }
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return { error: "Inicia sesión de nuevo para continuar." };
  const target = form.get("targetId");
  if (typeof target !== "string") return { error: "Falta la cuenta objetivo." };
  const preview = await getAccountDeletionPreview(target);
  if (preview.blockedReason) return { error: preview.blockedReason };
  const confirmation = form.get("confirmation");
  const password = form.get("password");
  const reason = form.get("reason");
  if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== preview.email.toLowerCase()) return { error: "Escribe el correo de la cuenta que quieres eliminar." };
  if (typeof password !== "string" || !password || password.length > 1024) return { error: "Confirma tu contraseña actual." };
  if (!preview.isSelf && (typeof reason !== "string" || reason.trim().length < 5 || reason.length > 500)) return { error: "Indica un motivo de entre 5 y 500 caracteres." };
  const successors: Record<string, string> = {};
  for (const org of preview.organizations) {
    const successor = form.get(`successor_${org.id}`);
    if (typeof successor !== "string" || !org.candidates.some(c => c.id === successor)) return { error: `Elige un administrador activo para ${org.name}.` };
    successors[org.id] = successor;
  }
  const superSuccessor = form.get("superAdminSuccessor");
  if (preview.lastSuperAdmin && (typeof superSuccessor !== "string" || !preview.superAdminCandidates.some(c => c.id === superSuccessor))) return { error: "Elige una cuenta activa para asumir la superadministración." };
  const admin = createAdminClient();
  const limit = await admin.rpc("account_action_allowed", { p_actor_id: user.id, p_action: "reauth" });
  if (limit.error || limit.data !== true) return { error: "Espera 15 minutos antes de volver a confirmar la contraseña." };
  // A separate, non-persistent Auth client proves password ownership right now.
  const reauth = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await reauth.auth.signInWithPassword({ email: user.email, password });
  if (result.error || result.data.user?.id !== user.id || !result.data.session) return { error: "No se pudo confirmar tu contraseña actual." };
  const claims = JSON.parse(Buffer.from(result.data.session.access_token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
  if (!claims.session_id) { await reauth.auth.signOut({ scope: "local" }); return { error: "No se pudo verificar la sesión reciente." }; }
  const tracking = randomBytes(32).toString("hex");
  const started = await admin.rpc("begin_account_deletion", {
    p_actor_id: user.id, p_target_id: target, p_actor_session_id: claims.session_id,
    p_confirmation_email: confirmation, p_reason: typeof reason === "string" ? reason : null,
    p_successors: successors, p_super_successor: preview.lastSuperAdmin ? superSuccessor : null,
    p_tracking_hash: createHash("sha256").update(tracking).digest("hex"),
  });
  await reauth.auth.signOut({ scope: "local" });
  if (started.error || typeof started.data !== "string") return { error: "No se pudo iniciar la eliminación. Revisa la sucesión y vuelve a cargar la página; no se ha declarado completada." };
  (await cookies()).set(DELETION_COOKIE, `${started.data}.${tracking}`, { httpOnly: true, secure: process.env.NODE_ENV === "production" && !origin?.startsWith("http://localhost"), sameSite: "strict", path: "/", maxAge: 30 * 24 * 60 * 60 });
  const jobId = started.data;
  after(async () => { await processAccountDeletionJobs(1, jobId); });
  redirect("/cuenta/eliminacion");
}
