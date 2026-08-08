"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";

export type RegisterState = {
  error: string | null;
  checkEmail?: boolean;
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

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      // Igual que en /forgot-password: con la plantilla de email por
      // defecto, este enlace pasa primero por el servidor de Supabase y
      // luego redirige aquí. /login no necesita sesión para nada, así que
      // sirve como destino simple sin importar cómo llegue la redirección.
      emailRedirectTo: `${siteUrl}${await orgPath("/login")}`,
    },
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

  // Registrarse en /o/<slug> añade al roster de ESA organización aunque el
  // usuario no haya comprado nada todavía. Se hace con el cliente admin
  // porque la policy de organization_students solo permite insertar a los
  // admins de la organización, no al propio alumno; y se hace ya (el id de
  // auth.users existe aunque falte confirmar el correo) para no depender de
  // que vuelva a pasar por aquí tras confirmar. Igual que en el resto de
  // altas: si ya existe una fila (incluida 'removed'), no se toca — nunca se
  // reactiva a alguien expulsado por este camino.
  const admin = createAdminClient();
  const { data: existingMembership } = await admin
    .from("organization_students")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await admin
      .from("organization_students")
      .insert({
        organization_id: organization.id,
        user_id: data.user.id,
        status: "active",
        joined_via: "self_register",
      });

    if (membershipError) {
      return { error: membershipError.message };
    }
  }

  // Con "Confirm email" activado en Supabase, signUp() no devuelve sesión
  // hasta que el usuario abra el enlace de su correo — en ese caso no hay
  // nada más que hacer aquí que avisarle. Si no está activado, sí hay sesión
  // y se entra directo, como antes.
  if (!data.session) {
    return { error: null, checkEmail: true };
  }

  redirect(await orgPath("/cursos"));
}
