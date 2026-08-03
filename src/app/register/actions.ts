"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAIN_COURSE_ID } from "@/lib/courses/mainCourse";

export type RegisterState = {
  error: string | null;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password) {
    return { error: "Completa todos los campos." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  // La fila en "profiles" la crea el trigger on_auth_user_created (ver
  // docs/database.md) a partir de raw_user_meta_data.name — no hace falta
  // insertarla a mano aquí, y así el perfil existe también si el usuario se
  // crea por otra vía (invitación, magic link, panel de Supabase, etc.).

  redirect(`/cursos/${MAIN_COURSE_ID}`);
}
