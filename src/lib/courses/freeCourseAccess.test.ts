import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  freeCourseGrantMessage,
  isFreeCoursePrice,
  isPaidCoursePrice,
  parseFiniteCoursePrice,
} from "./freeCourseAccess.ts";

describe("precio de cursos gratuitos", () => {
  test("solo acepta cero finito, incluso cuando Postgres devuelve decimal como texto", () => {
    assert.equal(isFreeCoursePrice(0), true);
    assert.equal(isFreeCoursePrice("0.00"), true);
    assert.equal(isFreeCoursePrice(-0), true);
    assert.equal(isFreeCoursePrice(0.01), false);
  });

  test("rechaza valores no finitos, vacíos y tipos ajenos", () => {
    for (const value of [Infinity, -Infinity, NaN, "", "  ", "Infinity", null, undefined]) {
      assert.equal(parseFiniteCoursePrice(value), null);
      assert.equal(isFreeCoursePrice(value), false);
      assert.equal(isPaidCoursePrice(value), false);
    }
  });

  test("solo los importes positivos y finitos pueden abrir checkout", () => {
    assert.equal(isPaidCoursePrice("49.99"), true);
    assert.equal(isPaidCoursePrice(0), false);
    assert.equal(isPaidCoursePrice(-1), false);
  });
});

describe("mensajes del RPC de acceso gratuito", () => {
  test("no muestra error para una concesión idempotente", () => {
    assert.equal(freeCourseGrantMessage("granted"), "");
    assert.equal(freeCourseGrantMessage("already_has_access"), "");
  });

  test("explica el checkout pendiente sin sugerir un segundo cobro", () => {
    assert.match(freeCourseGrantMessage("checkout_pending"), /no se te cobrará de nuevo/i);
  });
});
