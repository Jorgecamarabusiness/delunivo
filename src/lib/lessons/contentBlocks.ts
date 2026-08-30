import type { ContentBlock } from "../../types/index.ts";
import { isUuid } from "../mux/validation.ts";

const MAX_BLOCKS_PER_LESSON = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 2_000;
const MAX_TEXT_LENGTH = 1_000_000;

type ValidationResult =
  | { blocks: ContentBlock[]; error: null }
  | { blocks: null; error: string };

function optionalTitle(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("El título del bloque no es válido.");
  const title = value.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new Error(`El título debe tener entre 1 y ${MAX_TITLE_LENGTH} caracteres.`);
  }
  return title;
}

function requiredString(
  value: unknown,
  message: string,
  maxLength: number
): string {
  if (typeof value !== "string") throw new Error(message);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(message);
  return text;
}

export function validateContentBlocks(value: unknown): ValidationResult {
  try {
    if (!Array.isArray(value) || value.length > MAX_BLOCKS_PER_LESSON) {
      throw new Error(`Una lección puede tener como máximo ${MAX_BLOCKS_PER_LESSON} bloques.`);
    }

    const seenIds = new Set<string>();
    const blocks = value.map((raw): ContentBlock => {
      if (!raw || typeof raw !== "object") {
        throw new Error("Hay un bloque de contenido no válido.");
      }
      const block = raw as Record<string, unknown>;
      const id = requiredString(block.id, "El bloque no tiene un ID válido.", 128);
      if (seenIds.has(id)) throw new Error("Hay IDs de bloque duplicados.");
      seenIds.add(id);

      const title = optionalTitle(block.title);

      if (block.type === "text") {
        if (typeof block.content !== "string" || block.content.length > MAX_TEXT_LENGTH) {
          throw new Error("El contenido de texto no es válido o es demasiado largo.");
        }
        return { id, type: "text", title, content: block.content };
      }

      if (block.type === "video") {
        const videoUrl = requiredString(
          block.video_url,
          "La URL del vídeo embebido no es válida.",
          MAX_URL_LENGTH
        );
        let parsed: URL;
        try {
          parsed = new URL(videoUrl);
        } catch {
          throw new Error("La URL del vídeo embebido no es válida.");
        }
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("La URL del vídeo embebido no es válida.");
        }
        return { id, type: "video", title, video_url: videoUrl };
      }

      if (block.type === "video_file") {
        const muxVideoAssetId = block.mux_video_asset_id;
        const legacyUrl = block.video_url;

        if (muxVideoAssetId !== undefined) {
          if (!isUuid(id) || !isUuid(muxVideoAssetId)) {
            throw new Error("El vídeo de Mux no tiene identificadores válidos.");
          }
          return {
            id,
            type: "video_file",
            title,
            mux_video_asset_id: muxVideoAssetId,
          };
        }

        return {
          id,
          type: "video_file",
          title,
          video_url: requiredString(
            legacyUrl,
            "La ruta del vídeo heredado no es válida.",
            MAX_URL_LENGTH
          ),
        };
      }

      throw new Error("El tipo de bloque de contenido no está permitido.");
    });

    return { blocks, error: null };
  } catch (error) {
    return {
      blocks: null,
      error: error instanceof Error ? error.message : "Contenido no válido.",
    };
  }
}
