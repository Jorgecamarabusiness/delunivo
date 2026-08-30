import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateContentBlocks } from "./contentBlocks.ts";

const blockId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

describe("lesson content block validation", () => {
  test("keeps legacy Supabase video blocks compatible", () => {
    const result = validateContentBlocks([
      { id: "legacy-block", type: "video_file", title: "Clase", video_url: "videos/a.mp4" },
    ]);
    assert.equal(result.error, null);
    assert.equal(result.blocks?.[0].type, "video_file");
  });

  test("accepts a Mux block only with matching UUID-shaped identifiers", () => {
    const result = validateContentBlocks([
      { id: blockId, type: "video_file", title: "Clase", mux_video_asset_id: assetId },
    ]);
    assert.equal(result.error, null);
    assert.deepEqual(result.blocks?.[0], {
      id: blockId,
      type: "video_file",
      title: "Clase",
      mux_video_asset_id: assetId,
    });
  });

  test("rejects duplicate block IDs and forged Mux IDs", () => {
    assert.match(
      validateContentBlocks([
        { id: "same", type: "text", content: "one" },
        { id: "same", type: "text", content: "two" },
      ]).error ?? "",
      /duplicados/
    );
    assert.match(
      validateContentBlocks([
        { id: blockId, type: "video_file", mux_video_asset_id: "not-a-uuid" },
      ]).error ?? "",
      /identificadores válidos/
    );
  });
});
