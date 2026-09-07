import { processMuxDeletionJobs } from "@/lib/mux/deletionJobs";
import { processAccountDeletionJobs } from "@/lib/account-deletion/worker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const accounts = await processAccountDeletionJobs(5);
    const rejected = await createAdminClient().rpc("queue_rejected_mux_assets");
    if (rejected.error) throw new Error("video_reconciliation_failed");
    const mux = await processMuxDeletionJobs(50);
    const retention = await createAdminClient().rpc("purge_expired_operational_data");
    if (retention.error) throw new Error("retention_failed");
    return Response.json({ accounts, mux });
  } catch {
    console.error("operational_cleanup_failed");
    return Response.json({ error: "No se pudo procesar la cola." }, { status: 500 });
  }
}
