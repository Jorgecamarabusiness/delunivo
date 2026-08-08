"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";

export type ResetPasswordState = {
  error: string | null;
};

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    return { error: "Introduce una contraseña nueva." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Este enlace ha caducado o no es válido. Pide uno nuevo desde \"¿Has olvidado tu contraseña?\".",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect(`${await orgPath("/login")}?password=actualizada`);
}
