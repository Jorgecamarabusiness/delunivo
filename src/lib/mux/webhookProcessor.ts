import {
  normalizeMuxVideoEvent,
  type MuxVideoTransition,
  type MuxWebhookEventLike,
} from "./events.ts";

export type MuxWebhookClaim = "claimed" | "duplicate" | "in_progress";

export type MuxWebhookRepository = {
  claim(event: MuxWebhookEventLike): Promise<MuxWebhookClaim>;
  apply(transition: MuxVideoTransition): Promise<void>;
  complete(eventId: string): Promise<void>;
  fail(eventId: string, message: string): Promise<void>;
};

export async function processMuxWebhookEvent(
  event: MuxWebhookEventLike,
  repository: MuxWebhookRepository
): Promise<{ claim: MuxWebhookClaim; applied: boolean }> {
  const claim = await repository.claim(event);
  if (claim !== "claimed") {
    return { claim, applied: false };
  }

  try {
    const transition = normalizeMuxVideoEvent(event);
    if (transition) {
      await repository.apply(transition);
    }
    await repository.complete(event.id);
    return { claim, applied: Boolean(transition) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await repository.fail(event.id, message);
    throw error;
  }
}
