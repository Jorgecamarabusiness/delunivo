import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeStatusError,
  issueStatusError,
} from "./verificationCodeStatus.ts";

test("mapea los estados atómicos de emisión sin filtrar detalles internos", () => {
  assert.equal(issueStatusError("issued"), null);
  assert.match(issueStatusError("rate_limited_email")!, /15 minutos/);
  assert.match(issueStatusError("rate_limited_global")!, /unos minutos/);
  assert.equal(
    issueStatusError("unexpected"),
    "No se pudo generar el código de verificación."
  );
});

test("mapea consumo, caducidad e intentos restantes", () => {
  assert.equal(consumeStatusError({ status: "consumed" }), null);
  assert.match(consumeStatusError({ status: "expired" })!, /caducado/);
  assert.match(
    consumeStatusError({ status: "too_many_attempts" })!,
    /Demasiados intentos/
  );
  assert.equal(
    consumeStatusError({ status: "incorrect", attempts_left: 2 }),
    "Código incorrecto. Te quedan 2 intentos."
  );
  assert.equal(
    consumeStatusError({ status: "incorrect", attempts_left: 0 }),
    "Código incorrecto. Pide un código nuevo."
  );
  assert.match(consumeStatusError(null)!, /ningún código pendiente/);
});
