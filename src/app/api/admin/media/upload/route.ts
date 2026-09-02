import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import {
  MAX_PUBLIC_IMAGE_BYTES,
  declaredTypeMatches,
  detectPublicImageType,
} from "@/lib/storage/publicImage";

const BUCKET = "public-media";
type ScopeType = "brand" | "course" | "lesson";

function isScopeType(value: FormDataEntryValue | null): value is ScopeType {
  return value === "brand" || value === "course" || value === "lesson";
}

async function authorizeScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  scopeType: ScopeType,
  scopeId: string
): Promise<{ organizationId: string | null; error: string | null }> {
  if (scopeType === "brand") {
    const membership = await getCurrentOrgMembership(supabase, userId);
    if (!membership) {
      return { organizationId: null, error: "No perteneces a ninguna empresa." };
    }
    const check = await requireOrgAdmin(supabase, {
      organizationId: membership.organizationId,
    });
    return {
      organizationId: check.error ? null : membership.organizationId,
      error: check.error,
    };
  }

  const check = await requireOrgAdmin(
    supabase,
    scopeType === "course" ? { courseId: scopeId } : { lessonId: scopeId }
  );
  if (check.error) return { organizationId: null, error: check.error };

  if (scopeType === "course") {
    const { data } = await supabase
      .from("courses")
      .select("organization_id")
      .eq("id", scopeId)
      .maybeSingle();
    return { organizationId: data?.organization_id ?? null, error: null };
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", scopeId)
    .maybeSingle();
  if (!lesson) return { organizationId: null, error: null };

  const { data: course } = await supabase
    .from("courses")
    .select("organization_id")
    .eq("id", lesson.course_id)
    .maybeSingle();
  return { organizationId: course?.organization_id ?? null, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const scopeType = formData.get("scopeType");
  const scopeId = String(formData.get("scopeId") ?? "").trim();

  if (!(file instanceof File) || !isScopeType(scopeType)) {
    return NextResponse.json({ error: "Datos de subida inválidos." }, { status: 400 });
  }
  if (scopeType !== "brand" && !scopeId) {
    return NextResponse.json({ error: "Falta el recurso de destino." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_PUBLIC_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "La imagen debe ocupar entre 1 byte y 10 MB." },
      { status: 400 }
    );
  }

  const authorization = await authorizeScope(
    supabase,
    user.id,
    scopeType,
    scopeId
  );
  if (authorization.error || !authorization.organizationId) {
    return NextResponse.json(
      { error: authorization.error ?? "No se encontró el recurso de destino." },
      { status: 403 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectPublicImageType(bytes.subarray(0, 16));
  if (!detected || !declaredTypeMatches(file.type, detected)) {
    return NextResponse.json(
      { error: "El contenido no es una imagen PNG, JPEG, WebP o GIF válida." },
      { status: 400 }
    );
  }

  const path = `${authorization.organizationId}/${scopeType}/${crypto.randomUUID()}.${detected.extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      cacheControl: "31536000",
      upsert: false,
      contentType: detected.mime,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl });
}
