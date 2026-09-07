import type { SupabaseClient } from "@supabase/supabase-js";

type Job = { id: string; target_user_id: string; stage: string; lease_token: string; attempts: number };

export async function runAccountDeletionJobs(admin: SupabaseClient, settleOpenCheckouts: (userId: string) => Promise<void>, limit = 5, jobId?: string) {
  let completed = 0;
  let retried = 0;
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const claimed = await admin.rpc("claim_account_deletion_job", { p_job_id: jobId ?? null });
    if (claimed.error) throw new Error("No se pudo reclamar la solicitud de eliminación.");
    const candidate = (claimed.data as Job[] | null)?.[0];
    if (!candidate) break;
    const job: Job = candidate;
    async function advance(stage: string) {
      const now = new Date();
      const result = await admin.from("account_deletion_jobs").update({
        stage,
        updated_at: now.toISOString(),
        lease_until: new Date(now.getTime() + 5 * 60_000).toISOString(),
      })
        .eq("id", job.id).eq("lease_token", job.lease_token).gt("lease_until", now.toISOString()).select("id").maybeSingle();
      if (result.error || !result.data) throw new Error("lease_lost");
      job.stage = stage;
    }
    try {
      if (job.stage === "sessions") {
        const banned = await admin.auth.admin.updateUserById(job.target_user_id, { ban_duration: "876000h" });
        if (banned.error && banned.error.code !== "user_not_found") throw new Error("auth_unavailable");
        await advance("checkouts");
      }
      if (job.stage === "checkouts") {
        await settleOpenCheckouts(job.target_user_id);
        await advance("storage");
      }
      if (job.stage === "storage") {
        const detached = await admin.rpc("detach_account_school_storage", { p_job_id: job.id, p_lease_token: job.lease_token });
        if (detached.error) throw new Error("storage_unavailable");
        if (detached.data !== 0) throw new Error("storage_review_required");
        await advance("personal_data");
      }
      if (job.stage === "personal_data") {
        const cleaned = await admin.rpc("clean_account_personal_data", { p_job_id: job.id, p_lease_token: job.lease_token });
        if (cleaned.error) throw new Error("dependencies_remain");
        await advance("auth");
      }
      if (job.stage === "auth") {
        await advance("auth");
        const deleted = await admin.auth.admin.deleteUser(job.target_user_id);
        if (deleted.error && deleted.error.code !== "user_not_found") throw new Error("auth_finalization_failed");
        const finished = await admin.from("account_deletion_jobs").update({ status: "completed", stage: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error_code: null, lease_until: null, lease_token: null })
          .eq("id", job.id).eq("lease_token", job.lease_token).select("id").maybeSingle();
        if (finished.error || !finished.data) throw new Error("completion_record_failed");
        completed++;
      }
    } catch (error) {
      const knownCodes = new Set(["storage_review_required", "storage_unavailable", "auth_unavailable", "dependencies_remain", "auth_finalization_failed", "completion_record_failed", "lease_lost"]);
      const code = error instanceof Error && knownCodes.has(error.message) ? error.message : "provider_reconciliation_failed";
      const saved = await admin.from("account_deletion_jobs").update({ status: "retry", last_error_code: code, lease_token: null, lease_until: null, updated_at: new Date().toISOString(), next_attempt_at: new Date(Date.now() + Math.min(86400, 60 * 2 ** Math.min(job.attempts, 10)) * 1000).toISOString() })
        .eq("id", job.id).eq("lease_token", job.lease_token);
      if (saved.error) throw new Error("No se pudo registrar el reintento; la concesión temporal caducará y permitirá recuperarlo.");
      retried++;
    }
  }
  return { completed, retried };
}
