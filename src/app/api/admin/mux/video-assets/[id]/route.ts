import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { isUuid } from "@/lib/mux/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Asset no válido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: asset, error } = await admin
    .from("video_assets")
    .select(
      "id, lesson_id, status, error_type, error_message, duration_seconds, aspect_ratio, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !asset) {
    return NextResponse.json({ error: "No se encontró el vídeo." }, { status: 404 });
  }

  const adminCheck = await requireOrgAdmin(supabase, { lessonId: asset.lesson_id });
  if (adminCheck.error) {
    return NextResponse.json({ error: adminCheck.error }, { status: 403 });
  }

  return NextResponse.json(
    {
      id: asset.id,
      status: asset.status,
      errorType: asset.error_type,
      errorMessage: asset.error_message,
      durationSeconds: asset.duration_seconds,
      aspectRatio: asset.aspect_ratio,
      updatedAt: asset.updated_at,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
