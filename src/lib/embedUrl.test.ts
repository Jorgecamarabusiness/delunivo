import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAllowedEmbed, getSafeExternalUrl } from "./embedUrl.ts";

describe("allowlist de embeds", () => {
  test("normaliza URLs válidas de YouTube y Vimeo", () => {
    assert.deepEqual(getAllowedEmbed("https://youtu.be/dQw4w9WgXcQ"), { provider: "YouTube", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
    assert.deepEqual(getAllowedEmbed("https://vimeo.com/123456"), { provider: "Vimeo", embedUrl: "https://player.vimeo.com/video/123456" });
  });

  test("rechaza hosts, IDs y protocolos no permitidos", () => {
    for (const value of ["https://youtube.ejemplo.test/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=corto", "http://vimeo.com/123456", "javascript:alert(1)", "https://loom.com/share/abc"]) assert.equal(getAllowedEmbed(value), null);
  });

  test("solo ofrece enlace externo http(s) seguro para contenido heredado", () => {
    assert.equal(getSafeExternalUrl("https://loom.com/share/abc"), "https://loom.com/share/abc");
    assert.equal(getSafeExternalUrl("javascript:alert(1)"), null);
  });
});
