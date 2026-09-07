import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  coursePath,
  metadataDescription,
  organizationPath,
  platformUrl,
} from "./publicUrls.ts";

describe("URLs públicas para SEO", () => {
  test("construye rutas canónicas de escuela y curso escapando cada segmento", () => {
    assert.equal(organizationPath("academia ana"), "/o/academia%20ana");
    assert.equal(
      coursePath("academia-ana", "curso/introduccion"),
      "/o/academia-ana/cursos/curso%2Fintroduccion"
    );
    assert.equal(platformUrl("/o/academia-ana"), "https://www.delunivo.com/o/academia-ana");
  });

  test("usa contenido textual breve para la descripción sin filtrar HTML", () => {
    assert.equal(
      metadataDescription("", " <p> Curso  <strong>práctico</strong> </p> "),
      "Curso práctico"
    );
    assert.equal(metadataDescription(null, undefined), undefined);
  });
});
