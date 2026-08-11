"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgPath } from "@/lib/organizations/orgPath";
import { findUserByEmail } from "@/lib/auth/accounts";
import {
  issueVerificationCode,
  CODE_TTL_MINUTES,
} from "@/lib/auth/verificationCodes";
import { sendPasswordResetCodeEmail } from "@/lib/email/templates";

export type ForgotPasswordState = {
  error: string | null;
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Introduce tu correo electrónico." };
  }

  const admin = createAdminClient();
  const user = await findUserByEmail(admin, email);

  // Si el correo no está registrado se sigue igual hasta la pantalla del
  // código, sin enviar nada: responder distinto permitiría averiguar qué
  // direcciones tienen cuenta.
  if (user) {
    const { code, error: codeError } = await issueVerificationCode(
      email,
      "password_reset"
    );
    if (codeError) {
      return { error: codeError };
    }

    const { error: emailError } = await sendPasswordResetCodeEmail({
      to: email,
      code,
      minutes: CODE_TTL_MINUTES,
    });
    if (emailError) {
      return { error: emailError };
    }
  }

  redirect(
    `${await orgPath("/reset-password")}?email=${encodeURIComponent(email)}`
  );
}
