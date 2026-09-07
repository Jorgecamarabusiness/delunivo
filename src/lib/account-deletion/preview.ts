import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectSensitiveActionDuringImpersonation } from "@/lib/auth/impersonation";

export const DELETION_COOKIE = "delunivo_account_deletion";
type Candidate = { id: string; name: string; email: string };
export type AccountDeletionPreview = {
  targetId: string; email: string; name: string; isSelf: boolean;
  isSuperAdmin: boolean; lastSuperAdmin: boolean;
  organizations: { id: string; name: string; slug: string; needsSuccessor: boolean; candidates: Candidate[] }[];
  superAdminCandidates: Candidate[];
  counts: { schools: number; courses: number; purchases: number };
  blockedReason: string | null;
};

export async function getAccountDeletionPreview(targetId?: string): Promise<AccountDeletionPreview> {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const target = targetId || user.id;
  if (!/^[0-9a-f-]{36}$/i.test(target)) notFound();
  const { data: isSuperAdmin, error: roleError } = await client.rpc("is_super_admin");
  if (roleError || (target !== user.id && !isSuperAdmin)) notFound();
  const admin = createAdminClient();
  const [profileResult, membershipResult, studentResult, purchaseResult, superResult, ownedResult] = await Promise.all([
    admin.from("profiles").select("id,email,name,is_super_admin,account_status").eq("id", target).maybeSingle(),
    admin.from("organization_admins").select("organization_id,role").eq("user_id", target),
    admin.from("organization_students").select("organization_id").eq("user_id", target),
    admin.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", target),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_super_admin", true).eq("account_status", "active"),
    admin.from("organizations").select("id").eq("owner_id", target),
  ]);
  if ([profileResult,membershipResult,studentResult,purchaseResult,superResult,ownedResult].some(r => r.error)) throw new Error("No se pudo comprobar el alcance de la cuenta.");
  const profile = profileResult.data;
  if (!profile) notFound();
  const ownerIds = [...new Set([...(membershipResult.data ?? []).filter(m => m.role === "owner").map(m => m.organization_id), ...(ownedResult.data ?? []).map(o => o.id)])];
  const organizations: AccountDeletionPreview["organizations"] = [];
  for (const id of ownerIds) {
    const [organizationResult, adminsResult] = await Promise.all([
      admin.from("organizations").select("id,name,slug").eq("id", id).single(),
      admin.from("organization_admins").select("user_id").eq("organization_id", id).neq("user_id", target),
    ]);
    if (organizationResult.error || adminsResult.error) throw new Error("No se pudo comprobar la sucesión de la escuela.");
    const ids = (adminsResult.data ?? []).map(a => a.user_id);
    const candidatesResult = ids.length ? await admin.from("profiles").select("id,name,email").in("id", ids).eq("account_status", "active") : { data: [], error: null };
    if (candidatesResult.error) throw new Error("No se pudo consultar a los administradores.");
    organizations.push({ ...organizationResult.data, needsSuccessor: true, candidates: candidatesResult.data ?? [] });
  }
  const lastSuperAdmin = profile.is_super_admin && superResult.count === 1;
  const candidatesResult = lastSuperAdmin && isSuperAdmin ? await admin.from("profiles").select("id,name,email").neq("id", target).eq("account_status", "active").order("created_at").limit(100) : { data: [], error: null };
  const courseResult = ownerIds.length ? await admin.from("courses").select("id", { count: "exact", head: true }).in("organization_id", ownerIds) : { count: 0, error: null };
  if (candidatesResult.error || courseResult.error) throw new Error("No se pudo completar la comprobación de alcance.");
  return {
    targetId: target, email: profile.email, name: profile.name, isSelf: target === user.id,
    isSuperAdmin: profile.is_super_admin, lastSuperAdmin, organizations,
    superAdminCandidates: candidatesResult.data ?? [],
    counts: { schools: new Set([...(membershipResult.data ?? []).map(m => m.organization_id), ...(studentResult.data ?? []).map(m => m.organization_id), ...ownerIds]).size, courses: courseResult.count ?? 0, purchases: purchaseResult.count ?? 0 },
    blockedReason: profile.account_status !== "active" ? "Esta cuenta ya está en proceso de eliminación." : await rejectSensitiveActionDuringImpersonation(user.id),
  };
}

export async function getTrackedDeletionJob() {
  const value = (await cookies()).get(DELETION_COOKIE)?.value;
  if (!value) return null;
  const [id, token] = value.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-f0-9]{64}$/.test(token ?? "")) return null;
  const { data, error } = await createAdminClient().from("account_deletion_jobs")
    .select("id,status,stage,tracking_hash,last_error_code,next_attempt_at").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const expected = Buffer.from(data.tracking_hash, "hex");
  const actual = createHash("sha256").update(token).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? data : null;
}

export async function getAccountDeletionStatus(): Promise<{ state: "processing" | "retry" | "completed"; stage: string } | null> {
  const job = await getTrackedDeletionJob();
  if (!job) return null;
  const stages: Record<string, string> = {
    sessions: "Revocando sesiones y bloqueando nuevas operaciones.",
    checkouts: "Conciliando pagos abiertos sin eliminar los contratos de las escuelas.",
    storage: "Conservando los archivos de las escuelas y resolviendo su propiedad.",
    personal_data: "Eliminando datos personales y separando el historial necesario.",
    auth: "Finalizando la eliminación de la identidad.", completed: "Cuenta eliminada.",
  };
  return { state: job.status === "completed" ? "completed" : job.status === "retry" ? "retry" : "processing",
    stage: job.last_error_code === "storage_review_required" ? "Quedan archivos cuya propiedad necesita revisión de soporte. El trabajo se conserva; no se han borrado archivos compartidos." : stages[job.stage] ?? "Procesando solicitud." };
}
