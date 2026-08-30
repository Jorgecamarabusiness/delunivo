import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MuxWebhookEventLike } from "./events.ts";
import {
  processMuxWebhookEvent,
  type MuxWebhookClaim,
  type MuxWebhookRepository,
} from "./webhookProcessor.ts";

const event: MuxWebhookEventLike = {
  id: "evt-ready",
  type: "video.asset.ready",
  created_at: "2026-08-30T12:05:00Z",
  data: {
    id: "asset-1",
    upload_id: "upload-1",
    status: "ready",
    playback_ids: [{ id: "signed-id", policy: "signed" }],
  },
};

function fakeRepository(claim: MuxWebhookClaim) {
  const calls: string[] = [];
  const repository: MuxWebhookRepository = {
    async claim() {
      calls.push("claim");
      return claim;
    },
    async apply() {
      calls.push("apply");
    },
    async complete() {
      calls.push("complete");
    },
    async fail() {
      calls.push("fail");
    },
  };
  return { calls, repository };
}

describe("Mux webhook processor integration", () => {
  test("applies and completes a newly claimed event", async () => {
    const { calls, repository } = fakeRepository("claimed");
    const result = await processMuxWebhookEvent(event, repository);

    assert.deepEqual(result, { claim: "claimed", applied: true });
    assert.deepEqual(calls, ["claim", "apply", "complete"]);
  });

  test("does not reapply duplicate or concurrently processing events", async () => {
    for (const claim of ["duplicate", "in_progress"] as const) {
      const { calls, repository } = fakeRepository(claim);
      const result = await processMuxWebhookEvent(event, repository);
      assert.deepEqual(result, { claim, applied: false });
      assert.deepEqual(calls, ["claim"]);
    }
  });

  test("records a failed processing attempt so Mux can retry", async () => {
    const { calls, repository } = fakeRepository("claimed");
    repository.apply = async () => {
      calls.push("apply");
      throw new Error("database unavailable");
    };

    await assert.rejects(processMuxWebhookEvent(event, repository), /database unavailable/);
    assert.deepEqual(calls, ["claim", "apply", "fail"]);
  });
});
