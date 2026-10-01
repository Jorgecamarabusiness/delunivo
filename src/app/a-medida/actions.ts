"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectSensitiveActionDuringImpersonation } from "@/lib/auth/impersonation";
export async function requestCustomPlan(
  _: { error: string | null; success?: boolean },
  form: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión para registrar tu solicitud." };
  const blocked = await rejectSensitiveActionDuringImpersonation(user.id);
  if (blocked) return { error: blocked };
  const message = String(form.get("message") ?? "").trim();
  if (message.length < 10 || message.length > 2000)
    return {
      error: "Describe tus necesidades en entre 10 y 2.000 caracteres.",
    };
  const admin = createAdminClient();
  const saved = await admin.rpc("record_platform_custom_request", {
    p_user_id: user.id,
    p_message: message,
  });
  if (saved.error?.message.includes("custom_request_rate_limit"))
    return {
      error: "Ya has registrado solicitudes hoy. Revisaremos las recibidas.",
    };
  if (saved.error) return { error: "No se pudo registrar la solicitud." };
  return { error: null, success: true };
}
