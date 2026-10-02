"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireSuperAdmin} from "@/lib/auth/requireOrgAdmin";
import {rejectSensitiveActionDuringImpersonation} from "@/lib/auth/impersonation";
import {parseProviderEvidence} from "@/lib/billing/providerEvidence";
import {isUuid} from "@/lib/mux/validation";
type State={error:string|null;message?:string};
async function actor() {
  const db=await createClient();const user=(await db.auth.getUser()).data.user;
  if(!user || (await requireSuperAdmin(db)).error || await rejectSensitiveActionDuringImpersonation(user.id)) throw new Error("Solo un superadministrador fuera de Run as puede registrar esta operación.");
  return user.id;
}
export async function recordProviderEvidenceAction(_:State,form:FormData):Promise<State> {
  try {
    const id=await actor();const value=parseProviderEvidence(String(form.get("evidence")??""));
    const saved=await createAdminClient().rpc("record_platform_provider_statement",{p_actor_id:id,p_statement:value.statement,p_lines:value.lines});
    if(saved.error) throw new Error("La evidencia no concilia o no pudo guardarse. Comprueba sus importes y ventanas.");
    revalidatePath("/admin/plataforma");return {error:null,message:"Fuente registrada. Correcciones conservadas; los assets sin vínculo siguen sin atribución."};
  } catch(error){return {error:error instanceof Error ? error.message : "No se pudo registrar la fuente."};}
}
export async function grantCapacityExceptionAction(_:State,form:FormData):Promise<State> {
  try {
    const id=await actor();const org=String(form.get("organizationId")??"");const nonce=String(form.get("nonce")??"");
    const expires=String(form.get("expiresAt")??"");const seconds=Number(form.get("seconds"));
    if(!/Z$/.test(expires)) throw new Error("El vencimiento debe indicar UTC con Z al final.");
    if(!isUuid(org)||!isUuid(nonce)||!Number.isFinite(Date.parse(expires))||!Number.isFinite(seconds)) throw new Error("Escuela, cantidad o vencimiento inválidos.");
    const saved=await createAdminClient().rpc("grant_platform_capacity_exception",{p_id:nonce,p_actor_id:id,p_organization_id:org,p_resource:String(form.get("resource")??""),p_seconds:seconds,p_reason:String(form.get("reason")??"").trim(),p_expires_at:new Date(expires).toISOString()});
    if(saved.error) throw new Error("La excepción no cumple cantidad, autor, motivo y vencimiento, o ya cambió su solicitud.");
    revalidatePath("/admin/plataforma");return {error:null,message:"Excepción auditada y concedida una sola vez hasta su vencimiento."};
  }catch(error){return {error:error instanceof Error ? error.message : "No se pudo conceder la excepción."};}
}
