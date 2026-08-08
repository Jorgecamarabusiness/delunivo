"use server";

import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";

export type ForgotPasswordState = {
  error: string | null;
  sent?: boolean;
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Introduce tu correo electrónico." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Con la plantilla de email por defecto de Supabase (sin SMTP propio, no se
  // puede editar), el enlace pasa primero por el servidor de Supabase y
  // LUEGO redirige aquí con la sesión en el fragmento (#) de la URL, no en
  // query params — por eso "redirectTo" apunta directo a la página, que la
  // procesa en el cliente (ver ResetPasswordForm.tsx).
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}${await orgPath("/reset-password")}`,
  });

  // Supabase no informa si el correo existe o no (evita poder comprobar qué
  // emails están registrados) — mostramos el mismo mensaje de éxito siempre,
  // salvo un fallo real de envío (rate limit, correo con formato inválido...).
  if (error) {
    return { error: "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos." };
  }

  return { error: null, sent: true };
}
