"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership, type OrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { generateInvitationToken } from "@/lib/invitations/token";
import { sendInvitationEmail } from "@/lib/email/templates";

type ActionResult = { error: string | null; created?: boolean };

export type InvitationInput = {
  email: string;
  note: string;
  courseIds: string[];
};

const INVITATION_TTL_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MembershipContext =
  | { error: string }
  | {
      error: null;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      membership: OrgMembership;
    };

async function requireCurrentMembership(): Promise<MembershipContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) {
    return { error: "No perteneces a ninguna organización." };
  }

  return { error: null, supabase, userId: user.id, membership };
}

async function createInvitation(
  ctx: Extract<MembershipContext, { error: null }>,
  email: string,
  inviteType: "student" | "admin",
  courseIds: string[],
  note: string
): Promise<ActionResult> {
  const { data: organization } = await ctx.supabase
    .from("organizations")
    .select("name")
    .eq("id", ctx.membership.organizationId)
    .single();

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await ctx.supabase.rpc("create_invitation_with_courses", {
    p_organization_id: ctx.membership.organizationId,
    p_email: email,
    p_invite_type: inviteType,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
    p_note: note || null,
    p_course_ids: courseIds,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya hay una invitación pendiente para ese correo." };
    }
    return { error: error.message };
  }

  const { error: emailError } = await sendInvitationEmail({
    to: email,
    organizationName: organization?.name ?? "tu organización",
    inviteType,
    token,
  });

  revalidatePath("/admin/usuarios");

  // La invitación ya está guardada y es válida; si el email no salió, se avisa
  // para que el admin pueda revocarla y reintentar en vez de quedarse pensando
  // que el correo se envió.
  if (emailError) {
    return {
      error: `Invitación creada, pero no se pudo enviar el correo: ${emailError}`,
      created: true,
    };
  }

  return { error: null };
}

function normalizeInvitationInput(input: InvitationInput) {
  const email = typeof input?.email === "string" ? input.email : "";
  const note = typeof input?.note === "string" ? input.note : "";
  const courseIds = Array.isArray(input?.courseIds)
    ? input.courseIds.filter(
        (courseId): courseId is string =>
          typeof courseId === "string" && UUID_PATTERN.test(courseId)
      )
    : [];

  return {
    email: email.trim().toLowerCase(),
    note: note.trim(),
    courseIds: [...new Set(courseIds)],
  };
}

export async function inviteStudentAction(input: InvitationInput): Promise<ActionResult> {
  const normalized = normalizeInvitationInput(input);
  if (!EMAIL_PATTERN.test(normalized.email)) {
    return { error: "Introduce un correo válido." };
  }
  if (normalized.note.length > 1000) {
    return { error: "La nota no puede superar los 1000 caracteres." };
  }
  if (normalized.courseIds.length === 0) {
    return { error: "Selecciona al menos un curso." };
  }

  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  const { data: validCourses } = await ctx.supabase
    .from("courses")
    .select("id")
    .eq("organization_id", ctx.membership.organizationId)
    .in("id", normalized.courseIds);

  if ((validCourses ?? []).length !== normalized.courseIds.length) {
    return { error: "Alguno de los cursos seleccionados no pertenece a tu empresa." };
  }

  return createInvitation(
    ctx,
    normalized.email,
    "student",
    normalized.courseIds,
    normalized.note
  );
}

export async function inviteAdminAction(input: InvitationInput): Promise<ActionResult> {
  const normalized = normalizeInvitationInput(input);
  if (!EMAIL_PATTERN.test(normalized.email)) {
    return { error: "Introduce un correo válido." };
  }
  if (normalized.note.length > 1000) {
    return { error: "La nota no puede superar los 1000 caracteres." };
  }

  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  if (ctx.membership.role !== "owner") {
    return {
      error: "Solo el propietario de la empresa puede invitar a otros administradores.",
    };
  }

  return createInvitation(ctx, normalized.email, "admin", [], normalized.note);
}

export async function removeStudentAction(
  studentUserId: string,
  reason: string | null
): Promise<ActionResult> {
  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("organization_students")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: ctx.userId,
      removed_reason: reason,
    })
    .eq("organization_id", ctx.membership.organizationId)
    .eq("user_id", studentUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function reactivateStudentAction(
  studentUserId: string
): Promise<ActionResult> {
  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  const { error } = await ctx.supabase
    .from("organization_students")
    .update({
      status: "active",
      removed_at: null,
      removed_by: null,
      removed_reason: null,
    })
    .eq("organization_id", ctx.membership.organizationId)
    .eq("user_id", studentUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function removeAdminAction(adminUserId: string): Promise<ActionResult> {
  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  if (ctx.membership.role !== "owner") {
    return { error: "Solo el propietario puede quitar administradores." };
  }

  if (adminUserId === ctx.userId) {
    return { error: "No puedes quitarte a ti mismo como administrador." };
  }

  const { error } = await ctx.supabase
    .from("organization_admins")
    .delete()
    .eq("organization_id", ctx.membership.organizationId)
    .eq("user_id", adminUserId);

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function revokeInvitationAction(
  invitationId: string
): Promise<ActionResult> {
  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  const { data: revoked, error } = await ctx.supabase.rpc("revoke_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) return { error: error.message };
  if (!revoked) return { error: "La invitaciÃ³n ya no estÃ¡ pendiente." };

  revalidatePath("/admin/usuarios");
  return { error: null };
}
