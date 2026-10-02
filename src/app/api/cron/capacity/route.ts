import { runCapacityMaintenance } from "@/lib/billing/worker";

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runCapacityMaintenance();
    return Response.json(result, { status: result.failures?.length ? 503 : 200 });
  } catch {
    return Response.json({ error: "capacity_maintenance_failed" }, { status: 503 });
  }
}
