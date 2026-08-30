import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { createMuxApiClient } from "@/lib/mux/config";
import {
  isUuid,
  resolveAllowedUploadOrigin,
  validateMuxVideoFile,
} from "@/lib/mux/validation";

type UploadRequest = {
  lessonId?: unknown;
  blockId?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
};

export async function POST(request: NextRequest) {
  let body: UploadRequest;
  try {
    body = (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }

  if (!isUuid(body.lessonId) || !isUuid(body.blockId)) {
    return NextResponse.json(
      { error: "La lección o el bloque no tienen un identificador válido." },
      { status: 400 }
    );
  }

  const fileValidationError = validateMuxVideoFile({
    size: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
    type: typeof body.mimeType === "string" ? body.mimeType : "",
  });
  if (fileValidationError) {
    return NextResponse.json({ error: fileValidationError }, { status: 400 });
  }

  const origin = resolveAllowedUploadOrigin(
    request.url,
    request.headers.get("origin"),
    process.env.NEXT_PUBLIC_SITE_URL
  );
  if (!origin) {
    return NextResponse.json({ error: "Origen de carga no permitido." }, { status: 403 });
  }

  const supabase = await createClient();
  const adminCheck = await requireOrgAdmin(supabase, { lessonId: body.lessonId });
  if (adminCheck.error) {
    return NextResponse.json({ error: adminCheck.error }, { status: 403 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, course_id")
    .eq("id", body.lessonId)
    .maybeSingle();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: "No se encontró la lección." }, { status: 404 });
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, organization_id")
    .eq("id", lesson.course_id)
    .maybeSingle();

  if (courseError || !course) {
    return NextResponse.json({ error: "No se encontró el curso." }, { status: 404 });
  }

  const admin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1_000).toISOString();
  const { count: recentUploads, error: countError } = await admin
    .from("video_assets")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .eq("lesson_id", lesson.id)
    .eq("block_id", body.blockId)
    .in("status", ["waiting_for_upload", "processing"])
    .gte("created_at", tenMinutesAgo);

  if (countError) {
    return NextResponse.json(
      { error: "No se pudo comprobar el estado de las cargas." },
      { status: 500 }
    );
  }
  if ((recentUploads ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Hay demasiadas cargas recientes para este bloque. Espera unos minutos." },
      { status: 429 }
    );
  }

  const videoAssetId = randomUUID();
  const mux = createMuxApiClient();

  let upload: Awaited<ReturnType<typeof mux.video.uploads.create>>;
  try {
    upload = await mux.video.uploads.create({
      cors_origin: origin,
      timeout: 24 * 60 * 60,
      new_asset_settings: {
        passthrough: videoAssetId,
        playback_policies: ["signed"],
        max_resolution_tier: "1080p",
        video_quality: "basic",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Mux no pudo preparar la carga. Inténtalo de nuevo." },
      { status: 502 }
    );
  }

  if (!upload.url) {
    return NextResponse.json(
      { error: "Mux no devolvió una URL de carga." },
      { status: 502 }
    );
  }

  const { error: registerError } = await admin.rpc("register_mux_direct_upload", {
    p_video_asset_id: videoAssetId,
    p_organization_id: course.organization_id,
    p_course_id: course.id,
    p_lesson_id: lesson.id,
    p_block_id: body.blockId,
    p_created_by: user.id,
    p_mux_upload_id: upload.id,
  });

  if (registerError) {
    try {
      await mux.video.uploads.cancel(upload.id);
    } catch {
      // La cancelación es best-effort: el upload todavía no contiene bytes.
    }
    return NextResponse.json(
      { error: "No se pudo asociar la carga con la lección." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      videoAssetId,
      uploadUrl: upload.url,
      uploadId: upload.id,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
