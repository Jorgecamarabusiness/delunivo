/** Explicit pause switch. Existing accounts, content and payment webhooks remain available. */
export function isPersonalPreviewMode(): boolean {
  return process.env.PERSONAL_PREVIEW_MODE === "true";
}

export const PERSONAL_PREVIEW_MESSAGE = "Proyecto personal en pausa. Las nuevas contrataciones y compras están desactivadas.";
