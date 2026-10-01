"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectSensitiveActionDuringImpersonation } from "@/lib/auth/impersonation";
export async function requestCustomPlan(_: { error: string | null; success?: boolean }, form: FormData): Promise<{error:string|null;success?:boolean}> {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return {error:"Inicia sesión para registrar tu solicitud."};
  const blocked=await rejectSensitiveActionDuringImpersonation(user.id);
  if(blocked) return {error:blocked};
  const message=String(form.get("message")??"").trim();
  if(message.length<10||message.length>2000) return {error:"Describe tus necesidades en entre 10 y 2.000 caracteres."};
  const admin=createAdminClient();
  const count=await admin.from("platform_custom_requests").select("id",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",new Date(Date.now()-86400000).toISOString());
  if(count.error) return {error:"No se pudo comprobar tu solicitud. Inténtalo de nuevo."};
  if((count.count??0)>=3) return {error:"Ya has registrado solicitudes hoy. Revisaremos las recibidas."};
  const saved=await admin.from("platform_custom_requests").insert({user_id:user.id,message});
  if(saved.error) return {error:"No se pudo registrar la solicitud."};
  return {error:null,success:true};
}
