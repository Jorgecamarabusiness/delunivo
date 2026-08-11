"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgPath } from "@/lib/organizations/orgPath";
import {
  findUserByEmail,
  startSessionForVerifiedEmail,
} from "@/lib/auth/accounts";
import { consumeVerificationCode } from "@/lib/auth/verificationCodes";

export type ResetPasswordState = {
  error: string | null;
};

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !code) {
    return { error: "Introduce el código que te hemos enviado." };
  }
  if (!password) {
    return { error: "Introduce una contraseña nueva." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const { error: codeError } = await consumeVerificationCode(
    email,
    "password_reset",
    code
  );
  if (codeError) {
    return { error: codeError };
  }

  const admin = createAdminClient();
  const user = await findUserByEmail(admin, email);
  if (!user) {
    return { error: "No encontramos ninguna cuenta con ese correo." };
  }

  // Cambiar la contraseña con un código recibido en el correo demuestra que el
  // usuario controla ese buzón, así que la dirección queda verificada también
  // (cubre el caso de quien se registró y nunca llegó a confirmarla).
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (updateError) {
    return { error: updateError.message };
  }

  const started = await startSessionForVerifiedEmail(email);

  redirect(
    started
      ? await orgPath("/cursos")
      : `${await orgPath("/login")}?password=actualizada`
  );
}
