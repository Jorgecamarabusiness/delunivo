import assert from "node:assert/strict";
import { test } from "node:test";
import { courseConfirmationText } from "./courseConfirmation.ts";

test("old purchases do not invent consent or contract terms", () => {
  const text = courseConfirmationText({ id: "synthetic", created_at: "2026-01-01", amount_paid: 10, contract_snapshot: null });
  assert.match(text, /No se conserva una copia/);
  assert.doesNotMatch(text, /Solicitud expresa.*Sí/);
});
test("download preserves the saved offer and clearly identifies missing seller terms", () => {
  const text = courseConfirmationText({ id: "synthetic", created_at: "2026-01-01", amount_paid: 10,
    contract_snapshot: { course_title: "Original offer", immediate_access_requested: true } });
  assert.match(text, /Curso: Original offer/);
  assert.match(text, /Solicitud expresa de acceso inmediato: Sí/);
  assert.match(text, /Duración y condiciones de acceso: No facilitado/);
  assert.match(text, /no sustituye la factura/);
});
