import test from "node:test";
import assert from "node:assert/strict";
import {
  declaredTypeMatches,
  detectPublicImageType,
} from "./publicImage.ts";

test("detecta firmas reales de PNG, JPEG, GIF y WebP", () => {
  assert.deepEqual(
    detectPublicImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])),
    { mime: "image/png", extension: "png" }
  );
  assert.equal(
    detectPublicImageType(Uint8Array.from([0xff, 0xd8, 0xff]))?.mime,
    "image/jpeg"
  );
  assert.equal(
    detectPublicImageType(new TextEncoder().encode("GIF89a......"))?.mime,
    "image/gif"
  );
  assert.equal(
    detectPublicImageType(new TextEncoder().encode("RIFF....WEBP"))?.mime,
    "image/webp"
  );
});

test("rechaza contenido disfrazado y MIME declarado incoherente", () => {
  assert.equal(
    detectPublicImageType(new TextEncoder().encode("<svg><script>")),
    null
  );
  assert.equal(
    declaredTypeMatches("image/jpeg", { mime: "image/png", extension: "png" }),
    false
  );
  assert.equal(
    declaredTypeMatches("", { mime: "image/png", extension: "png" }),
    true
  );
});
