"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSignedVideoUrl } from "@/lib/storage/media";

export async function getVideoPreviewUrlAction(
  videoPath: string
): Promise<string | null> {
  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if (adminCheck.error) return null;

  return getSignedVideoUrl(videoPath);
}
