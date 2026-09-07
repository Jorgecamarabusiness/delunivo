import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxSigningClient } from "@/lib/mux/config";
import { isUuid, validateMuxVideoDuration } from "@/lib/mux/validation";
import { playbackTokenLifetimeSeconds } from "@/lib/mux/playbackSession";
import type { ContentBlock } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Vídeo no válido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: asset, error: assetError } = await admin
    .from("video_assets")
    .select(
      "id, organization_id, course_id, lesson_id, block_id, mux_playback_id, status, is_current, duration_seconds"
    )
    .eq("id", id)
    .maybeSingle();

  if (assetError || !asset || !asset.is_current) {
    return NextResponse.json({ error: "Vídeo no encontrado." }, { status: 404 });
  }

  const [{ data: lesson }, { data: course }] = await Promise.all([
    admin
      .from("lessons")
      .select("id, course_id, status, blocks")
      .eq("id", asset.lesson_id)
      .maybeSingle(),
    admin
      .from("courses")
      .select("id, organization_id, status")
      .eq("id", asset.course_id)
      .maybeSingle(),
  ]);

  if (
    !lesson ||
    !course ||
    lesson.course_id !== course.id ||
    course.organization_id !== asset.organization_id
  ) {
    return NextResponse.json({ error: "La asociación del vídeo no es válida." }, { status: 404 });
  }

  const blockIsAttached = ((lesson.blocks ?? []) as ContentBlock[]).some(
    (block) =>
      block.type === "video_file" &&
      block.id === asset.block_id &&
      block.mux_video_asset_id === asset.id
  );
  if (!blockIsAttached) {
    return NextResponse.json({ error: "El vídeo ya no está asociado a la lección." }, { status: 404 });
  }

  const [{ data: isAdmin }, { data: hasAccess }] = await Promise.all([
    supabase.rpc("is_org_admin", { org_id: asset.organization_id }),
    supabase.rpc("has_course_access", { target_course_id: asset.course_id }),
  ]);
  const studentCanWatch = Boolean(hasAccess) && lesson.status === "published" && course.status === "published";

  if (!isAdmin && !studentCanWatch) {
    return NextResponse.json({ error: "No tienes acceso a este vídeo." }, { status: 403 });
  }

  if (asset.status !== "ready" || !asset.mux_playback_id || validateMuxVideoDuration(asset.duration_seconds)) {
    return NextResponse.json(
      { error: "El vídeo todavía no está listo o no tiene una duración válida.", status: asset.status },
      { status: 409, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (new URL(request.url).searchParams.get("check") === "1") {
    return NextResponse.json({ authorized: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  let token: string;
  const lifetimeSeconds = playbackTokenLifetimeSeconds(asset.duration_seconds);
  const expiresAt = Math.floor(Date.now() / 1_000) * 1_000 + lifetimeSeconds * 1_000;
  try {
    const mux = createMuxSigningClient();
    token = await mux.jwt.signPlaybackId(asset.mux_playback_id, {
      type: "video",
      expiration: `${lifetimeSeconds}s`,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo autorizar la reproducción." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { playbackId: asset.mux_playback_id, token, expiresAt },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
