import { getAccountDeletionStatus, getTrackedDeletionJob } from "@/lib/account-deletion/preview";
import { processAccountDeletionJobs } from "@/lib/account-deletion/worker";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) return Response.json({ error: "Origen no válido." }, { status: 403 });
  const job = await getTrackedDeletionJob();
  if (!job) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
  // The database lease and next_attempt_at rate-limit this capability after logout.
  await processAccountDeletionJobs(1, job.id);
  return Response.json(await getAccountDeletionStatus(), { headers: { "Cache-Control": "private, no-store" } });
}
