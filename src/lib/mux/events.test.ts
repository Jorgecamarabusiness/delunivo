import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeMuxVideoEvent } from "./events.ts";

const videoAssetId = "11111111-1111-4111-8111-111111111111";

describe("Mux webhook normalization", () => {
  test("associates a completed direct upload with its asset", () => {
    const result = normalizeMuxVideoEvent({
      id: "evt-upload",
      type: "video.upload.asset_created",
      created_at: "2026-08-30T12:00:00Z",
      data: { id: "upload-1", asset_id: "asset-1" },
    });

    assert.deepEqual(result, {
      videoAssetId: null,
      uploadId: "upload-1",
      assetId: "asset-1",
      playbackId: null,
      status: "processing",
      eventCreatedAt: "2026-08-30T12:00:00.000Z",
      durationSeconds: null,
      aspectRatio: null,
      errorType: null,
      errorMessage: null,
    });
  });

  test("extracts only a signed playback id from a ready asset", () => {
    const result = normalizeMuxVideoEvent({
      id: "evt-ready",
      type: "video.asset.ready",
      created_at: "2026-08-30T12:05:00Z",
      data: {
        id: "asset-1",
        upload_id: "upload-1",
        passthrough: videoAssetId,
        status: "ready",
        duration: 3_601.25,
        aspect_ratio: "16:9",
        playback_ids: [
          { id: "public-id", policy: "public" },
          { id: "signed-id", policy: "signed" },
        ],
      },
    });

    assert.equal(result?.videoAssetId, videoAssetId);
    assert.equal(result?.status, "ready");
    assert.equal(result?.playbackId, "signed-id");
    assert.equal(result?.durationSeconds, 3_601.25);
  });

  test("rejects a ready event without signed playback", () => {
    assert.throws(
      () =>
        normalizeMuxVideoEvent({
          id: "evt-ready",
          type: "video.asset.ready",
          created_at: "2026-08-30T12:05:00Z",
          data: {
            id: "asset-1",
            status: "ready",
            playback_ids: [{ id: "public-id", policy: "public" }],
          },
        }),
      /playback ID firmado/
    );
  });

  test("maps terminal upload and asset events", () => {
    assert.equal(
      normalizeMuxVideoEvent({
        id: "evt-timeout",
        type: "video.upload.errored",
        created_at: "2026-08-30T12:05:00Z",
        data: { id: "upload-1", status: "timed_out" },
      })?.status,
      "timed_out"
    );
    assert.equal(
      normalizeMuxVideoEvent({
        id: "evt-deleted",
        type: "video.asset.deleted",
        created_at: "2026-08-30T12:06:00Z",
        data: { id: "asset-1", status: "ready" },
      })?.status,
      "deleted"
    );
  });

  test("ignores unrelated event types", () => {
    assert.equal(
      normalizeMuxVideoEvent({
        id: "evt-other",
        type: "video.live_stream.active",
        created_at: "2026-08-30T12:00:00Z",
        data: { id: "live-1" },
      }),
      null
    );
  });
});
