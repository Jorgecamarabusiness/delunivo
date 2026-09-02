"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { extractStoragePath, getSignedVideoUrl } from "@/lib/storage/media";
import type { ContentBlock } from "@/types";

export async function getVideoPreviewUrlAction(
  lessonId: string,
  videoPath: string
): Promise<string | null> {
  const supabase = await createClient();
  const adminCheck = await requireOrgAdmin(supabase, { lessonId });
  if (adminCheck.error) return null;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("blocks")
    .eq("id", lessonId)
    .maybeSingle();
  const requestedPath = extractStoragePath(videoPath);
  const isReferenced = ((lesson?.blocks ?? []) as ContentBlock[]).some(
    (block) =>
      block.type === "video_file" &&
      !block.mux_video_asset_id &&
      Boolean(block.video_url) &&
      extractStoragePath(block.video_url ?? "") === requestedPath
  );
  if (!isReferenced) return null;

  return getSignedVideoUrl(videoPath);
}
