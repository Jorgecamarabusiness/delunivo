import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/mux/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await (await createClient()).auth.getUser()).data.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  let body: { sessionId?: string; seconds?: number };
  try { body = await request.json(); } catch { return new Response("Invalid payload", { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.sessionId) || !Number.isFinite(body.seconds) || body.seconds! < 0 || body.seconds! > 60) return new Response("Invalid estimate", { status: 400 });
  const admin = createAdminClient();
  const session = await admin.from("platform_playback_sessions").select("id").eq("id", body.sessionId).eq("user_id", user.id).eq("video_asset_id", id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (session.error || !session.data) return new Response("Unauthorized session", { status: 403 });
  const saved = await admin.rpc("record_platform_playback_estimate", { p_session_id: body.sessionId, p_user_id: user.id, p_seconds: body.seconds });
  return Response.json({ recorded: !saved.error && saved.data === true }, { status: saved.error ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
}
