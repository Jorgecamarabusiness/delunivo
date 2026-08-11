"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import {
  issueVerificationCode,
  CODE_TTL_MINUTES,
} from "@/lib/auth/verificationCodes";
import { sendSignupCodeEmail } from "@/lib/email/templates";

export type LoginState = {
  error: string | null;
};

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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Cuenta creada pero sin verificar: en vez de dejarlo en un callejón sin
    // salida, se le manda un código nuevo y se le lleva a la pantalla de
    // verificación.
    if (/email not confirmed/i.test(error.message)) {
      const { code, error: codeError } = await issueVerificationCode(
        email,
        "signup"
      );

      if (!codeError) {
        await sendSignupCodeEmail({ to: email, code, minutes: CODE_TTL_MINUTES });
      }

      redirect(
        `${await orgPath("/verificar")}?email=${encodeURIComponent(email)}`
      );
    }

    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(next ?? (await orgPath("/cursos")));
}
