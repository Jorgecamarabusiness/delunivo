"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgPath } from "@/lib/organizations/orgPath";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import {
  findUserByEmail,
  startSessionForVerifiedEmail,
} from "@/lib/auth/accounts";
import {
  consumeVerificationCode,
  issueVerificationCode,
  CODE_TTL_MINUTES,
} from "@/lib/auth/verificationCodes";
import { sendSignupCodeEmail } from "@/lib/email/templates";

export type VerifyState = {
  error: string | null;
  resent?: boolean;
};

export async function verifyCodeAction(
  _prevState: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNextPath(formData.get("next"));

  if (!email || !code) {
    return { error: "Introduce el código que te hemos enviado." };
  }

  const { error: codeError } = await consumeVerificationCode(
    email,
    "signup",
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

  // A partir de aquí Supabase considera el correo verificado y deja iniciar
  // sesión con contraseña por su cuenta.
  const { error: confirmError } = await admin.auth.admin.updateUserById(
    user.id,
    { email_confirm: true }
  );
  if (confirmError) {
    return { error: confirmError.message };
  }

  // Se le deja la sesión iniciada para no obligarle a escribir la contraseña
  // que acaba de elegir. Si no se puede, va a /login: molesto pero no roto.
  const started = await startSessionForVerifiedEmail(email);

  redirect(
    started
      ? (next ?? (await orgPath("/cursos")))
      : `${await orgPath("/login")}?verificado=1`
  );
}

export async function resendCodeAction(
  _prevState: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Falta el correo al que enviar el código." };
  }

  // No se comprueba si la cuenta existe: responder distinto permitiría
  // averiguar qué correos están registrados.
  const admin = createAdminClient();
  const user = await findUserByEmail(admin, email);
  if (!user) {
    return { error: null, resent: true };
  }

  const { code, error: codeError } = await issueVerificationCode(email, "signup");
  if (codeError) {
    return { error: codeError };
  }

  const { error: emailError } = await sendSignupCodeEmail({
    to: email,
    code,
    minutes: CODE_TTL_MINUTES,
  });
  if (emailError) {
    return { error: emailError };
  }

  return { error: null, resent: true };
}
