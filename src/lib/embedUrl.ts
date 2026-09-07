const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;

export type AllowedEmbed = {
  provider: "YouTube" | "Vimeo";
  embedUrl: string;
};

/** Solo se incrustan proveedores revisados; ningún URL arbitrario llega a un iframe. */
export function getAllowedEmbed(url: string): AllowedEmbed | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();

    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
      if (id && YOUTUBE_ID.test(id)) {
        return { provider: "YouTube", embedUrl: `https://www.youtube.com/embed/${id}` };
      }
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (YOUTUBE_ID.test(id)) {
        return { provider: "YouTube", embedUrl: `https://www.youtube.com/embed/${id}` };
      }
    }
    if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
      const id = parsed.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1] ?? null;
      if (id && VIMEO_ID.test(id)) {
        return { provider: "Vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
      }
    }
  } catch {
    // El contenido heredado se presenta como no incrustable.
  }
  return null;
}

export function getSafeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
