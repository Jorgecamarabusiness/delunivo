import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readableTextColor } from "./brandColor.ts";

const NEGRO = "#0a0a0a";
const BLANCO = "#ffffff";

/**
 * Cada empresa elige su color de marca y ese color va de fondo en los botones.
 * Si el texto de encima fuera siempre blanco, una empresa que eligiera amarillo
 * tendría botones ilegibles — y parecería un fallo de Delunivo, no una mala
 * elección de color suya.
 */
describe("readableTextColor — texto legible sobre el color de marca", () => {
  test("sobre un color oscuro pone texto blanco", () => {
    assert.equal(readableTextColor("#0a0a0a"), BLANCO);
    assert.equal(readableTextColor("#a21647"), BLANCO); // el color real de Ivan Orgánico
  });

  test("sobre un color claro pone texto negro", () => {
    assert.equal(readableTextColor("#ffff00"), NEGRO); // amarillo
    assert.equal(readableTextColor("#ffffff"), NEGRO);
  });

  test("el verde de Delunivo elige negro porque da mayor contraste", () => {
    assert.equal(readableTextColor("#16a34a"), NEGRO);
  });

  test("acepta el formato corto de 3 dígitos", () => {
    assert.equal(readableTextColor("#fff"), NEGRO);
    assert.equal(readableTextColor("#000"), BLANCO);
  });

  test("acepta el color sin la almohadilla", () => {
    assert.equal(readableTextColor("ffffff"), NEGRO);
  });

  test("devuelve null si no hay color, para que se use el valor por defecto", () => {
    assert.equal(readableTextColor(null), null);
  });

  test("devuelve null con basura, en vez de romper la página entera", () => {
    assert.equal(readableTextColor("no-soy-un-color"), null);
    assert.equal(readableTextColor("#12345"), null);
    assert.equal(readableTextColor(""), null);
  });
});
