"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { createUnverifiedUser } from "@/lib/auth/accounts";
import {
  issueVerificationCode,
  CODE_TTL_MINUTES,
} from "@/lib/auth/verificationCodes";
import { sendSignupCodeEmail } from "@/lib/email/templates";
import { passwordPolicyError } from "@/lib/auth/passwordPolicy";

export type RegisterState = {
  error: string | null;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  // Defensa en profundidad: la página ya redirige fuera de /register en el
  // dominio raíz, pero la action no debe fiarse solo de eso.
  const organization = await getCurrentOrganization();
  if (!organization) {
    redirect("/");
  }

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
  const passwordError = passwordPolicyError(password);
  if (passwordError) return { error: passwordError };

  const admin = createAdminClient();

  const { userId, error: createError } = await createUnverifiedUser(admin, {
    email,
    password,
    name,
  });
  if (createError || !userId) {
    return { error: createError ?? "No se pudo crear la cuenta." };
  }

  // La fila en "profiles" la crea el trigger on_auth_user_created a partir de
  // raw_user_meta_data.name — ver docs/database.md.

  // Registrarse en /o/<slug> añade al roster de ESA organización aunque el
  // alumno no haya comprado nada todavía. Con el cliente admin porque la policy
  // de organization_students solo deja insertar a los admins de la
  // organización, no al propio alumno.
  const { error: membershipError } = await admin
    .from("organization_students")
    .insert({
      organization_id: organization.id,
      user_id: userId,
      status: "active",
      joined_via: "self_register",
    });

  if (membershipError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: membershipError.message };
  }

  const { code, error: codeError } = await issueVerificationCode(email, "signup");
  if (codeError) {
    const nextPath = await orgPath("/cursos");
    redirect(
      `${await orgPath("/verificar")}?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}&delivery=retry`
    );
  }

  const { error: emailError } = await sendSignupCodeEmail({
    to: email,
    code,
    minutes: CODE_TTL_MINUTES,
  });
  if (emailError) {
    const nextPath = await orgPath("/cursos");
    redirect(
      `${await orgPath("/verificar")}?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}&delivery=retry`
    );
  }

  const nextPath = await orgPath("/cursos");
  redirect(
    `${await orgPath("/verificar")}?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`
  );
}
