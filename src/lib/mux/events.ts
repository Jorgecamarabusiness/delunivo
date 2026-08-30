import { isUuid } from "./validation.ts";

export type MuxVideoStatus =
  | "waiting_for_upload"
  | "processing"
  | "ready"
  | "errored"
  | "cancelled"
  | "timed_out"
  | "deleted";

export type MuxWebhookEventLike = {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

export type MuxVideoTransition = {
  videoAssetId: string | null;
  uploadId: string | null;
  assetId: string | null;
  playbackId: string | null;
  status: MuxVideoStatus;
  eventCreatedAt: string;
  durationSeconds: number | null;
  aspectRatio: string | null;
  errorType: string | null;
  errorMessage: string | null;
};

function readString(value: unknown, maxLength = 1_000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readError(data: Record<string, unknown>): {
  type: string | null;
  message: string | null;
} {
  const direct = data.error;
  if (direct && typeof direct === "object") {
    const error = direct as Record<string, unknown>;
    return {
      type: readString(error.type, 200),
      message: readString(error.message),
    };
  }

  const errors = data.errors;
  if (errors && typeof errors === "object") {
    const value = errors as Record<string, unknown>;
    const messages = Array.isArray(value.messages) ? value.messages : [];
    const first = messages[0];
    if (first && typeof first === "object") {
      const error = first as Record<string, unknown>;
      return {
        type: readString(error.type, 200),
        message: readString(error.message),
      };
    }
    return { type: null, message: readString(value.message) };
  }

  return { type: null, message: null };
}

function readSignedPlaybackId(data: Record<string, unknown>): string | null {
  if (!Array.isArray(data.playback_ids)) return null;

  for (const item of data.playback_ids) {
    if (!item || typeof item !== "object") continue;
    const playback = item as Record<string, unknown>;
    if (playback.policy === "signed") {
      return readString(playback.id, 255);
    }
  }
  return null;
}

function normalizeEventDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("El webhook de Mux no contiene una fecha válida.");
  }
  return new Date(timestamp).toISOString();
}

function assetStatus(data: Record<string, unknown>): MuxVideoStatus {
  if (data.status === "ready") return "ready";
  if (data.status === "errored") return "errored";
  return "processing";
}

export function normalizeMuxVideoEvent(
  event: MuxWebhookEventLike
): MuxVideoTransition | null {
  const data = event.data;
  const createdAt = normalizeEventDate(event.created_at);
  const passthrough = readString(data.passthrough, 255);
  const videoAssetId = isUuid(passthrough) ? passthrough : null;
  const uploadId = readString(data.upload_id, 255);
  const assetId = readString(data.id, 255);
  const errors = readError(data);

  const base = {
    videoAssetId,
    eventCreatedAt: createdAt,
    durationSeconds: readFiniteNumber(data.duration),
    aspectRatio: readString(data.aspect_ratio, 50),
    errorType: errors.type,
    errorMessage: errors.message,
  };

  if (event.type === "video.upload.created") {
    return {
      ...base,
      uploadId: assetId,
      assetId: null,
      playbackId: null,
      status: "waiting_for_upload",
    };
  }

  if (event.type === "video.upload.asset_created") {
    return {
      ...base,
      uploadId: assetId,
      assetId: readString(data.asset_id, 255),
      playbackId: null,
      status: "processing",
    };
  }

  if (event.type === "video.upload.cancelled") {
    return {
      ...base,
      uploadId: assetId,
      assetId: readString(data.asset_id, 255),
      playbackId: null,
      status: "cancelled",
    };
  }

  if (event.type === "video.upload.errored") {
    return {
      ...base,
      uploadId: assetId,
      assetId: readString(data.asset_id, 255),
      playbackId: null,
      status: data.status === "timed_out" ? "timed_out" : "errored",
    };
  }

  if (
    event.type === "video.asset.created" ||
    event.type === "video.asset.updated" ||
    event.type === "video.asset.ready" ||
    event.type === "video.asset.errored" ||
    event.type === "video.asset.deleted"
  ) {
    let status = assetStatus(data);
    if (event.type === "video.asset.ready") status = "ready";
    if (event.type === "video.asset.errored") status = "errored";
    if (event.type === "video.asset.deleted") status = "deleted";

    const playbackId = readSignedPlaybackId(data);
    if (status === "ready" && !playbackId) {
      throw new Error("El asset listo no contiene un playback ID firmado.");
    }

    return {
      ...base,
      uploadId,
      assetId,
      playbackId,
      status,
    };
  }

  return null;
}
