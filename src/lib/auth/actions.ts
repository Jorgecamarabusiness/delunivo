"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";
import { getActiveImpersonationForUser } from "@/lib/auth/impersonation";
import { restoreActorSession } from "@/lib/auth/restoreImpersonation";

export async function signOutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (await getActiveImpersonationForUser(user.id))) {
    await restoreActorSession({ requestedStatus: "ended", reason: "Salida desde el header" });
    redirect("/admin/plataforma");
  }
  await supabase.auth.signOut();
  redirect(await orgPath("/login"));
}
