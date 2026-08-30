import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_MUX_VIDEO_BYTES,
  isUuid,
  resolveAllowedUploadOrigin,
  validateMuxVideoFile,
} from "./validation.ts";

describe("Mux upload validation", () => {
  test("only accepts UUIDs", () => {
    assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
    assert.equal(isUuid("not-a-uuid"), false);
  });

  test("accepts only the current or configured site origin", () => {
    assert.equal(
      resolveAllowedUploadOrigin(
        "https://preview.example.com/api/admin/mux/uploads",
        "https://preview.example.com",
        "https://aularia.example"
      ),
      "https://preview.example.com"
    );
    assert.equal(
      resolveAllowedUploadOrigin(
        "https://internal.vercel.app/api/admin/mux/uploads",
        "https://aularia.example",
        "https://aularia.example"
      ),
      "https://aularia.example"
    );
    assert.equal(
      resolveAllowedUploadOrigin(
        "https://aularia.example/api/admin/mux/uploads",
        "https://evil.example"
      ),
      null
    );
  });

  test("rejects empty, non-video and oversized files", () => {
    assert.equal(validateMuxVideoFile({ size: 0, type: "video/mp4" }), "El archivo está vacío.");
    assert.equal(
      validateMuxVideoFile({ size: 1_000, type: "application/pdf" }),
      "Selecciona un archivo de vídeo válido."
    );
    assert.equal(
      validateMuxVideoFile({ size: MAX_MUX_VIDEO_BYTES + 1, type: "video/mp4" }),
      "El vídeo supera el límite de 20 GB."
    );
    assert.equal(validateMuxVideoFile({ size: 1_000, type: "video/mp4" }), null);
  });
});
