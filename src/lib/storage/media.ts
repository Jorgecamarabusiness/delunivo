import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentBlock } from "@/types";

const BUCKET = "lesson-media";
const VIDEO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 2; // 2 horas

/**
 * `video_url` puede contener, según cuándo se subió el vídeo:
 * - una ruta ya relativa dentro del bucket (subidas nuevas): "videos/uuid.mp4"
 * - una URL pública antigua de cuando el bucket era público:
 *   ".../storage/v1/object/public/lesson-media/videos/uuid.mp4"
 * Ambos casos deben resolverse a la misma ruta relativa para poder firmarla.
 */
export function extractStoragePath(videoUrl: string): string {
  if (!/^https?:\/\//.test(videoUrl)) return videoUrl;

  try {
    const { pathname } = new URL(videoUrl);
    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
    ];

    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx !== -1) {
        return decodeURIComponent(pathname.slice(idx + marker.length));
      }
    }
  } catch {
    // no era una URL válida, se trata como ruta tal cual más abajo
  }

  return videoUrl;
}

export async function getSignedVideoUrl(
  videoUrl: string,
  expiresInSeconds = VIDEO_SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const path = extractStoragePath(videoUrl);
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Sustituye video_url de los bloques "video_file" por una URL firmada de corta
 * duración. Se llama solo después de comprobar en el servidor que el usuario
 * es admin o ha comprado el curso — la URL firmada resultante no vuelve a
 * pasar por ninguna comprobación de permisos, así que nunca debe generarse
 * antes de esa comprobación.
 */
export async function resolveBlocksForViewing(
  blocks: ContentBlock[]
): Promise<ContentBlock[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.type !== "video_file") return block;
      if (block.mux_video_asset_id) return block;
      if (!block.video_url) return block;

      const signedUrl = await getSignedVideoUrl(block.video_url);
      return { ...block, video_url: signedUrl ?? "" };
    })
  );
}
