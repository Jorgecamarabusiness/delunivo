"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership, type OrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { generateInvitationToken } from "@/lib/invitations/token";
import { sendInvitationEmail } from "@/lib/resend/sendInvitationEmail";

type ActionResult = { error: string | null };

const INVITATION_TTL_DAYS = 7;

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
  inviteType: "student" | "admin"
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

  const { error } = await ctx.supabase.from("invitations").insert({
    organization_id: ctx.membership.organizationId,
    email,
    invite_type: inviteType,
    token_hash: tokenHash,
    invited_by: ctx.userId,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya hay una invitación pendiente para ese correo." };
    }
    return { error: error.message };
  }

  await sendInvitationEmail({
    to: email,
    organizationName: organization?.name ?? "tu organización",
    inviteType,
    token,
  });

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function inviteStudentAction(email: string): Promise<ActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Introduce un correo." };

  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  return createInvitation(ctx, trimmed, "student");
}

export async function inviteAdminAction(email: string): Promise<ActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Introduce un correo." };

  const ctx = await requireCurrentMembership();
  if (ctx.error !== null) return { error: ctx.error };

  if (ctx.membership.role !== "owner") {
    return {
      error: "Solo el propietario de la empresa puede invitar a otros administradores.",
    };
  }

  return createInvitation(ctx, trimmed, "admin");
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

  const { error } = await ctx.supabase
    .from("invitations")
    .update({ status: "revoked", revoked_by: ctx.userId })
    .eq("id", invitationId)
    .eq("organization_id", ctx.membership.organizationId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}
