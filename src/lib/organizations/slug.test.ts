import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  isReservedSlug,
  validateOrganizationSlug,
} from "./slug.ts";

/**
 * El slug es la dirección pública de cada empresa (/o/<slug>), así que se genera
 * a partir del nombre que escribe el cliente al darse de alta. Tiene que salir
 * siempre una cadena válida para una URL, escriba lo que escriba.
 */
describe("slugify — el nombre de la empresa se convierte en su dirección", () => {
  test("pasa a minúsculas y cambia los espacios por guiones", () => {
    assert.equal(slugify("Cursos De Ana"), "cursos-de-ana");
  });

  test("quita los acentos y la eñe", () => {
    assert.equal(slugify("Diseño Gráfico"), "diseno-grafico");
    assert.equal(slugify("Ivan Orgánico"), "ivan-organico");
  });

  test("quita los signos y no deja guiones repetidos", () => {
    assert.equal(slugify("¡Hola! ¿Qué tal?"), "hola-que-tal");
  });

  test("no deja guiones sueltos al principio ni al final", () => {
    assert.equal(slugify("  Academia  "), "academia");
    assert.equal(slugify("--Academia--"), "academia");
  });

  test("un nombre solo de signos da cadena vacía, y la action lo rechaza", () => {
    assert.equal(slugify("!!!"), "");
    assert.equal(slugify(""), "");
  });

  test("el resultado solo tiene letras, números y guiones", () => {
    for (const nombre of ["Ñandú & Cía. S.L.", "Café 100% Natural", "über cool"]) {
      assert.match(slugify(nombre), /^[a-z0-9-]*$/, `falló con: ${nombre}`);
    }
  });
});

describe("isReservedSlug — direcciones que no puede ocupar un cliente", () => {
  test("'o' está reservado porque es el prefijo de todas las empresas", () => {
    assert.equal(isReservedSlug("o"), true);
  });

  test("'admin', 'api', 'www' y 'app' están reservados", () => {
    for (const reservado of ["admin", "api", "www", "app"]) {
      assert.equal(isReservedSlug(reservado), true, `debería estar reservado: ${reservado}`);
    }
  });

  test("un nombre normal no está reservado", () => {
    assert.equal(isReservedSlug("cursos-de-ana"), false);
  });
});

describe("validateOrganizationSlug — valida la dirección elegida", () => {
  test("normaliza el texto antes de validarlo", () => {
    assert.deepEqual(validateOrganizationSlug("  Iván Orgánico  "), {
      ok: true,
      slug: "ivan-organico",
    });
  });

  test("rechaza direcciones vacías, reservadas o demasiado largas", () => {
    assert.equal(validateOrganizationSlug("!!!").ok, false);
    assert.equal(validateOrganizationSlug("admin").ok, false);
    assert.equal(validateOrganizationSlug("a".repeat(64)).ok, false);
  });

  test("acepta una dirección normal de hasta 63 caracteres", () => {
    assert.equal(validateOrganizationSlug("mi-escuela").ok, true);
    assert.equal(validateOrganizationSlug("a".repeat(63)).ok, true);
  });
});
