"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, isReservedSlug } from "@/lib/organizations/slug";
import { createUnverifiedUser } from "@/lib/auth/accounts";
import {
  issueVerificationCode,
  CODE_TTL_MINUTES,
} from "@/lib/auth/verificationCodes";
import { sendSignupCodeEmail } from "@/lib/email/templates";

export type CreateCompanyState = {
  error: string | null;
};

const MAX_SLUG_ATTEMPTS = 20;

async function resolveUniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  baseSlug: string
): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate =
      attempt === 0 && !isReservedSlug(baseSlug) ? baseSlug : `${baseSlug}-${attempt + 1}`;

    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  return null;
}

export async function createCompanyAction(
  _prevState: CreateCompanyState,
  formData: FormData
): Promise<CreateCompanyState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();

  if (!name || !email || !password || !companyName) {
    return { error: "Completa todos los campos." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const baseSlug = slugify(companyName);
  if (!baseSlug) {
    return { error: "Pon un nombre de empresa válido." };
  }

  const admin = createAdminClient();

  // Se comprueba el slug ANTES de crear la cuenta: si no hay dirección libre,
  // mejor no dejar un usuario suelto sin empresa.
  const slug = await resolveUniqueSlug(admin, baseSlug);
  if (!slug) {
    return {
      error:
        "No se pudo generar una dirección única para tu empresa. Prueba con otro nombre.",
    };
  }

  // `createUnverifiedUser` usa admin.createUser, NO signUp(): con la
  // confirmación de correo activada, signUp() sobre un email ya registrado
  // devuelve un usuario falso con un uuid inventado, y el insert siguiente
  // reventaba con "organizations_owner_id_fkey". Ver src/lib/auth/accounts.ts.
  const { userId, error: createError } = await createUnverifiedUser(admin, {
    email,
    password,
    name,
  });
  if (createError || !userId) {
    return { error: createError ?? "No se pudo crear la cuenta." };
  }

  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .insert({ name: companyName, slug, owner_id: userId })
    .select("id")
    .single();

  if (orgError || !organization) {
    // Sin empresa, la cuenta recién creada no sirve para nada y además
    // bloquearía reintentar con el mismo correo. Se deshace.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: orgError?.message ?? "No se pudo crear la empresa." };
  }

  const [{ error: billingError }, { error: adminError }] = await Promise.all([
    admin.from("organization_billing").insert({
      organization_id: organization.id,
      platform_subscription_status: "canceled",
      access_mode: "standard",
    }),
    admin.from("organization_admins").insert({
      organization_id: organization.id,
      user_id: userId,
      role: "owner",
    }),
  ]);

  if (billingError || adminError) {
    return {
      error: (billingError ?? adminError)?.message ?? "No se pudo terminar de crear la empresa.",
    };
  }

  // La fila en "profiles" la crea el trigger on_auth_user_created.

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

  // Tras verificar el correo entra directo al panel; el cobro de la suscripción
  // se ofrece ahí (/admin/facturacion), con la empresa aún sin acceso.
  redirect(
    `/verificar?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/admin/facturacion")}`
  );
}
