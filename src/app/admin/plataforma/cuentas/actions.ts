"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { rejectSensitiveActionDuringImpersonation } from "@/lib/auth/impersonation";
import { processAccountDeletionJobs } from "@/lib/account-deletion/worker";
import { isUuid } from "@/lib/mux/validation";

export async function retryDeletionJobAction(form: FormData) {
  const id = String(form.get("jobId") ?? "");
  if (!isUuid(id)) throw new Error("Solicitud no válida.");
  const client = await createClient();
  const { error } = await requireSuperAdmin(client);
  const { data: { user } } = await client.auth.getUser();
  if (error || !user || await rejectSensitiveActionDuringImpersonation(user.id)) throw new Error("No puedes gestionar esta solicitud.");
  // Reuse the persisted authorization; the SQL claim preserves cooldown/lease.
  after(async () => { await processAccountDeletionJobs(1, id); });
  revalidatePath("/admin/plataforma/cuentas");
}
