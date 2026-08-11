import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safeNextPath.ts";

/**
 * Estos tests son de SEGURIDAD, no de comodidad. `next` viene de la URL, así que
 * lo controla quien manda el enlace: sin esta validación, alguien podría enviar
 * /login?next=https://sitio-falso.com y, tras iniciar sesión de verdad, mandar
 * al usuario a una copia del sitio que le pida la contraseña otra vez.
 */
describe("safeNextPath — protección contra redirección abierta", () => {
  test("acepta una ruta relativa normal", () => {
    assert.equal(safeNextPath("/cursos"), "/cursos");
  });

  test("acepta una ruta con prefijo de empresa", () => {
    assert.equal(safeNextPath("/o/ivanorganico/cursos"), "/o/ivanorganico/cursos");
  });

  test("rechaza una URL absoluta a otro dominio", () => {
    assert.equal(safeNextPath("https://sitio-falso.com"), null);
  });

  test("rechaza //evil.com, que el navegador trata como absoluta", () => {
    // Este es el caso que se escapa si solo se comprueba que empiece por "/".
    assert.equal(safeNextPath("//sitio-falso.com"), null);
  });

  test("rechaza una ruta que no empieza por barra", () => {
    assert.equal(safeNextPath("cursos"), null);
  });

  test("rechaza cualquier cosa que no sea texto", () => {
    assert.equal(safeNextPath(null), null);
    assert.equal(safeNextPath(undefined), null);
    assert.equal(safeNextPath(42), null);
    assert.equal(safeNextPath({}), null);
  });
});
