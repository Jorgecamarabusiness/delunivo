"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";

export type LoginState = {
  error: string | null;
};

function safeNextPath(next: FormDataEntryValue | null): string | null {
  // Solo rutas relativas propias — evita open redirect a otro dominio
  // (bloquea también "//evil.com", que el navegador trataría como absoluta).
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Completa todos los campos." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return {
        error: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
      };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(next ?? (await orgPath("/cursos")));
}
