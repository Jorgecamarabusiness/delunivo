import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxApiClient } from "./config";

type MuxDeletionJob = {
  id: number;
  mux_asset_id: string | null;
  mux_upload_id: string | null;
  attempts: number;
};

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; statusCode?: number };
  return candidate.status === 404 || candidate.statusCode === 404;
}

export async function processMuxDeletionJobs(limit = 20) {
  if (process.env.MUX_DELETION_MODE === "off") {
    return { claimed: 0, completed: 0, failed: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_mux_deletion_jobs", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(`No se pudo reclamar la cola de borrado de Mux: ${error.message}`);
  }

  const jobs = (data ?? []) as MuxDeletionJob[];
  if (jobs.length === 0) return { claimed: 0, completed: 0, failed: 0 };

  const mux = createMuxApiClient();
  let completed = 0;
  let failed = 0;

  await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.mux_asset_id) {
          await mux.video.assets.delete(job.mux_asset_id);
        } else if (job.mux_upload_id) {
          const upload = await mux.video.uploads.retrieve(job.mux_upload_id);
          if (upload.asset_id) {
            await mux.video.assets.delete(upload.asset_id);
          } else {
            await mux.video.uploads.cancel(job.mux_upload_id);
          }
        } else throw new Error("provider_reference_missing");

        const saved = await admin
          .from("mux_deletion_jobs")
          .update({
            status: "completed",
            last_error: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        if (saved.error) throw new Error("completion_record_failed");
        completed += 1;
      } catch (jobError) {
        if (isNotFound(jobError)) {
          const saved = await admin
            .from("mux_deletion_jobs")
            .update({
              status: "completed",
              last_error: null,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          if (saved.error) throw new Error("completion_record_failed");
          completed += 1;
          return;
        }

        const delayMinutes = Math.min(24 * 60, 2 ** Math.min(job.attempts, 10));
        const saved = await admin
          .from("mux_deletion_jobs")
          .update({
            status: "pending",
            last_error: "provider_cleanup_failed",
            next_attempt_at: new Date(
              Date.now() + delayMinutes * 60_000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        if (saved.error) throw new Error("retry_record_failed");
        failed += 1;
      }
    })
  );

  return { claimed: jobs.length, completed, failed };
}
