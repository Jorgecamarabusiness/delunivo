import { processMuxDeletionJobs } from "@/lib/mux/deletionJobs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    return Response.json(await processMuxDeletionJobs(50));
  } catch (error) {
    console.error("Falló el reintento programado de borrados de Mux.", error);
    return Response.json({ error: "No se pudo procesar la cola." }, { status: 500 });
  }
}
