export const MAX_MUX_VIDEO_BYTES = 20 * 1024 * 1024 * 1024;
export const MAX_MUX_VIDEO_KILOBYTES = MAX_MUX_VIDEO_BYTES / 1024;
export const MAX_MUX_VIDEO_SECONDS = 43_200;

export function validateMuxVideoDuration(duration: unknown): string | null {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return "No se pudo verificar la duración del vídeo.";
  }
  return duration > MAX_MUX_VIDEO_SECONDS
    ? "El vídeo supera el límite de 12 horas (43.200 segundos)."
    : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function resolveAllowedUploadOrigin(
  requestUrl: string,
  originHeader: string | null,
  configuredSiteUrl?: string
): string | null {
  if (!originHeader) return null;

  try {
    const origin = new URL(originHeader);
    if (origin.protocol !== "http:" && origin.protocol !== "https:") return null;

    const allowed = new Set([new URL(requestUrl).origin]);
    if (configuredSiteUrl) {
      allowed.add(new URL(configuredSiteUrl).origin);
    }

    return allowed.has(origin.origin) ? origin.origin : null;
  } catch {
    return null;
  }
}

export function validateMuxVideoFile(file: {
  size: number;
  type: string;
}): string | null {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return "El archivo está vacío.";
  }
  if (file.size > MAX_MUX_VIDEO_BYTES) {
    return "El vídeo supera el límite de 20 GiB.";
  }
  if (!file.type.startsWith("video/")) {
    return "Selecciona un archivo de vídeo válido.";
  }
  return null;
}
