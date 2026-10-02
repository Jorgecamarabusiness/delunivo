import { readIntegrationReadiness } from "@/lib/integrations/readiness";

export const maxDuration = 120;

export async function GET() {
  const result = await readIntegrationReadiness();
  const headers = { "Cache-Control": "private, no-store" };
  return result.ok
    ? Response.json(result.report, { headers })
    : Response.json({ error: result.error }, { status: 403, headers });
}
