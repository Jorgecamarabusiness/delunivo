import { getAccountDeletionStatus } from "@/lib/account-deletion/preview";
export async function GET() {
  const status = await getAccountDeletionStatus();
  return Response.json(status ?? { error: "Solicitud no encontrada." }, { status: status ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
}
