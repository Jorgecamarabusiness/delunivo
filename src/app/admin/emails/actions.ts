"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import type { ActionResult } from "@/types";

/**
 * Esta lista es de la PLATAFORMA, no de ninguna empresa: decide a qué buzones
 * se redirigen todos los emails cuando el envío real está desactivado. Por eso
 * la puerta es `requireSuperAdmin` y no `requireOrgAdmin`.
 */
async function guard(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await requireSuperAdmin(supabase);
  return error;
}

export async function addAdminEmailAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const guardError = await guard();
  if (guardError) return { error: guardError };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();

  if (!email.includes("@")) {
    return { error: "Introduce un correo válido." };
  }

  const { error } = await createAdminClient().from("admin_emails").insert({
    email,
    label: label || null,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese correo ya está en la lista." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/emails");
  return { error: null };
}

export async function toggleAdminEmailAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const guardError = await guard();
  if (guardError) return { error: guardError };

  const { error } = await createAdminClient()
    .from("admin_emails")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/emails");
  return { error: null };
}

export async function deleteAdminEmailAction(id: string): Promise<ActionResult> {
  const guardError = await guard();
  if (guardError) return { error: guardError };

  const { error } = await createAdminClient()
    .from("admin_emails")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/emails");
  return { error: null };
}
