"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, isReservedSlug } from "@/lib/organizations/slug";
import { createPlatformSubscriptionCheckoutUrl } from "@/lib/stripe/platformSubscription";

export type CreateCompanyState = {
  error: string | null;
  checkEmail?: boolean;
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

  const baseSlug = slugify(companyName);
  if (!baseSlug) {
    return { error: "Pon un nombre de empresa válido." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${siteUrl}/login`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  const admin = createAdminClient();
  const slug = await resolveUniqueSlug(admin, baseSlug);
  if (!slug) {
    return { error: "No se pudo generar una dirección única para tu empresa. Prueba con otro nombre." };
  }

  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .insert({ name: companyName, slug, owner_id: data.user.id })
    .select("id")
    .single();

  if (orgError || !organization) {
    return { error: orgError?.message ?? "No se pudo crear la empresa." };
  }

  const [{ error: billingError }, { error: adminError }] = await Promise.all([
    admin.from("organization_billing").insert({ organization_id: organization.id }),
    admin.from("organization_admins").insert({
      organization_id: organization.id,
      user_id: data.user.id,
      role: "owner",
    }),
  ]);

  if (billingError || adminError) {
    return {
      error: (billingError ?? adminError)?.message ?? "No se pudo terminar de crear la empresa.",
    };
  }

  // La fila en "profiles" la crea el trigger on_auth_user_created (ver
  // docs/database.md), igual que en el registro de alumno normal.

  if (!data.session) {
    return { error: null, checkEmail: true };
  }

  // Con sesión inmediata (confirm email desactivado), directo al pago —
  // si Stripe falla, no bloqueamos el alta: la empresa ya existe en
  // 'trialing' y puede suscribirse luego desde /admin/facturacion.
  const checkoutUrl = await createPlatformSubscriptionCheckoutUrl(
    organization.id,
    data.user.id
  );

  redirect(checkoutUrl ?? "/admin");
}
