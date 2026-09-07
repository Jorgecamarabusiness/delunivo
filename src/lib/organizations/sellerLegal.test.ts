import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  hasCompleteSellerLegalInfo,
  sellerDisplayName,
  sellerLegalMissingFields,
  validateSellerLegalInput,
} from "./sellerLegal.ts";

const complete = {
  seller_legal_name: "Escuela Ejemplo SL",
  seller_tax_id: "ID-FISCAL-LOCAL",
  seller_address: "Calle Ejemplo 1",
  seller_contact_email: "contacto@ejemplo.test",
  seller_country: "Colombia",
};

describe("información pública del vendedor", () => {
  test("acepta un identificador fiscal no español", () => {
    const result = validateSellerLegalInput({
      legalName: " Escuela Ejemplo SAS ",
      taxId: " NIT 900.000.000-1 ",
      address: " Bogotá ",
      contactEmail: "contacto@ejemplo.test",
      country: "Colombia",
    });

    assert.deepEqual(result, {
      ok: true,
      value: {
        seller_legal_name: "Escuela Ejemplo SAS",
        seller_tax_id: "NIT 900.000.000-1",
        seller_address: "Bogotá",
        seller_contact_email: "contacto@ejemplo.test",
        seller_country: "Colombia",
      },
    });
  });

  test("permite guardar un borrador incompleto, pero deja claro qué falta", () => {
    const draft = { ...complete, seller_tax_id: null, seller_address: null };
    assert.equal(hasCompleteSellerLegalInfo(draft), false);
    assert.deepEqual(sellerLegalMissingFields(draft), ["identificador fiscal", "domicilio"]);
  });

  test("valida el correo solo si se ha indicado y no inventa un vendedor", () => {
    assert.deepEqual(
      validateSellerLegalInput({
        legalName: "",
        taxId: "",
        address: "",
        contactEmail: "correo-invalido",
        country: "",
      }),
      { ok: false, error: "Introduce un correo de contacto válido." }
    );
    assert.equal(sellerDisplayName({ ...complete, seller_legal_name: null }, "Mi escuela"), "Mi escuela");
  });
});
