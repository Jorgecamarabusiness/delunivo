import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getSignedVideoUrl } from "@/lib/storage/media";

const BUCKET = "lesson-media";

const FOLDER_RULES: Record<
  "videos" | "images",
  { maxBytes: number; extensions: string[] }
> = {
  videos: {
    maxBytes: 500 * 1024 * 1024,
    extensions: ["mp4", "webm", "mov", "m4v"],
  },
  images: {
    maxBytes: 10 * 1024 * 1024,
    extensions: ["png", "jpg", "jpeg", "webp", "gif"],
  },
};

function isFolder(value: FormDataEntryValue | null): value is "videos" | "images" {
  return value === "videos" || value === "images";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  // No recibimos courseId/organizationId en esta ruta (ver Fase 9 del plan):
  // solo comprobamos que sea admin de ALGUNA organización, no de la
  // propietaria concreta de la lección donde acabará este archivo.
  const adminCheck = await requireAnyOrgAdmin(supabase);
  if (adminCheck.error) {
    return NextResponse.json({ error: adminCheck.error }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = formData.get("folder");

  if (!(file instanceof File) || !isFolder(folder)) {
    return NextResponse.json({ error: "Datos de subida inválidos." }, { status: 400 });
  }

  const rules = FOLDER_RULES[folder];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!rules.extensions.includes(extension)) {
    return NextResponse.json(
      { error: `Formato no permitido. Usa: ${rules.extensions.join(", ")}.` },
      { status: 400 }
    );
  }

  if (file.size > rules.maxBytes) {
    return NextResponse.json(
      { error: `El archivo supera el tamaño máximo permitido (${Math.round(rules.maxBytes / 1024 / 1024)} MB).` },
      { status: 400 }
    );
  }

  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  if (folder === "images") {
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ path, url: data.publicUrl });
  }

  const previewUrl = await getSignedVideoUrl(path, 60 * 30);
  return NextResponse.json({ path, url: previewUrl });
}
