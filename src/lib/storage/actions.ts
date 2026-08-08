"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getSignedVideoUrl } from "@/lib/storage/media";

export async function getVideoPreviewUrlAction(
  videoPath: string
): Promise<string | null> {
  const supabase = await createClient();

  // No sabemos a qué curso/organización pertenece este vídeo desde aquí
  // (ver Fase 9 del plan) — de momento solo comprobamos que sea admin de
  // ALGUNA organización, no de la propietaria concreta del vídeo.
  const adminCheck = await requireAnyOrgAdmin(supabase);
  if (adminCheck.error) return null;

  return getSignedVideoUrl(videoPath);
}
