"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInvitationToken } from "@/lib/invitations/token";

type ActionResult = { error: string | null };

type PendingInvitation = {
  id: string;
  organization_id: string;
  email: string;
  invite_type: "student" | "admin";
};

async function loadPendingInvitation(token: string): Promise<PendingInvitation | null> {
  const tokenHash = hashInvitationToken(token);
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, organization_id, email, invite_type, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) return null;
  if (invitation.status !== "pending") return null;
  if (new Date(invitation.expires_at) < new Date()) return null;

  return {
    id: invitation.id,
    organization_id: invitation.organization_id,
    email: invitation.email,
    invite_type: invitation.invite_type === "admin" ? "admin" : "student",
  };
}

/**
 * A dónde mandar tras aceptar. Los admins van a /admin (sin prefijo, se
 * resuelve por membership). Los alumnos necesitan el prefijo /o/<slug>
 * explícito: este enlace siempre se abre desde el dominio raíz (el email lo
 * manda sin prefijo a propósito, ver sendInvitationEmail.ts), y desde la
 * Fase 6 la raíz sin prefijo es la landing de registro de empresas, no el
 * sitio de ningún cliente — sin esto, un alumno recién aceptado aterrizaba
 * viendo "crea tu escuela online" en vez de sus cursos.
 */
async function redirectPathAfterAccept(
  admin: ReturnType<typeof createAdminClient>,
  invitation: PendingInvitation
): Promise<string> {
  if (invitation.invite_type === "admin") return "/admin";

  const { data: organization } = await admin
    .from("organizations")
    .select("slug")
    .eq("id", invitation.organization_id)
    .single();

  return organization ? `/o/${organization.slug}/cursos` : "/";
}

async function completeMembership(
  admin: ReturnType<typeof createAdminClient>,
  invitation: PendingInvitation,
  userId: string
) {
  if (invitation.invite_type === "admin") {
    await admin.from("organization_admins").upsert(
      { organization_id: invitation.organization_id, user_id: userId, role: "admin" },
      { onConflict: "organization_id,user_id" }
    );
  } else {
    // A diferencia del webhook de compra, aquí SÍ reactivamos si estaba
    // 'removed' — reinvitar a alguien es una decisión explícita del admin.
    await admin.from("organization_students").upsert(
      {
        organization_id: invitation.organization_id,
        user_id: userId,
        status: "active",
        joined_via: "invite",
      },
      { onConflict: "organization_id,user_id" }
    );
  }

  await admin.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);
}

export async function acceptInvitationWithNewAccountAction(
  token: string,
  password: string,
  confirmPassword: string
): Promise<ActionResult> {
  if (!password) return { error: "Introduce una contraseña." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };

  const invitation = await loadPendingInvitation(token);
  if (!invitation) return { error: "Esta invitación ha caducado o no es válida." };

  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", invitation.email)
    .maybeSingle();

  if (existingProfile) {
    return {
      error: "Ya existe una cuenta con ese correo. Inicia sesión para aceptar la invitación.",
    };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "No se pudo crear la cuenta." };
  }

  await completeMembership(admin, invitation, created.user.id);
  const target = await redirectPathAfterAccept(admin, invitation);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect(target);
}

export async function acceptInvitationWithExistingSessionAction(
  token: string
): Promise<ActionResult> {
  const invitation = await loadPendingInvitation(token);
  if (!invitation) return { error: "Esta invitación ha caducado o no es válida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: "Tienes que iniciar sesión con el correo invitado para aceptar." };
  }

  const admin = createAdminClient();
  await completeMembership(admin, invitation, user.id);
  const target = await redirectPathAfterAccept(admin, invitation);

  redirect(target);
}
