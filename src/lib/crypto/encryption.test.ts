import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { encrypt, decrypt } from "./encryption.ts";

/**
 * Aquí se cifran las API keys de Whop de cada cliente antes de guardarlas.
 * Si esto se rompiera, o bien se guardarían las claves en claro (cualquiera con
 * acceso a la base de datos las leería), o bien dejarían de poder descifrarse y
 * los clientes perderían su integración.
 */
const claveOriginal = process.env.ENCRYPTION_KEY;

before(() => {
  // Clave propia del test: no se depende de la del entorno, así que estos
  // tests corren igual en CI sin ningún secreto configurado.
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

after(() => {
  if (claveOriginal === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = claveOriginal;
});

describe("encrypt / decrypt — claves de pago de los clientes", () => {
  test("lo que se cifra se recupera igual", () => {
    const secreto = "apik_ejemplo_de_clave_de_whop";
    assert.equal(decrypt(encrypt(secreto)), secreto);
  });

  test("el texto cifrado NO contiene el original", () => {
    const secreto = "apik_ejemplo_de_clave_de_whop";
    assert.ok(!encrypt(secreto).includes(secreto));
  });

  test("cifrar dos veces lo mismo da resultados distintos (el IV es aleatorio)", () => {
    // Si diera siempre lo mismo, quien viera la base de datos podría saber que
    // dos clientes usan la misma clave sin llegar a descifrarla.
    assert.notEqual(encrypt("misma-clave"), encrypt("misma-clave"));
  });

  test("un texto cifrado manipulado NO se descifra: falla en vez de devolver basura", () => {
    // Es lo que aporta GCM frente a un cifrado sin autenticación.
    const cifrado = encrypt("clave-importante");
    const bytes = Buffer.from(cifrado, "base64");
    bytes[bytes.length - 1] ^= 0xff;

    assert.throws(() => decrypt(bytes.toString("base64")));
  });

  test("con otra clave no se puede descifrar", () => {
    const cifrado = encrypt("clave-importante");
    const anterior = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

    assert.throws(() => decrypt(cifrado));
    process.env.ENCRYPTION_KEY = anterior;
  });

  test("avisa si la clave del servidor no mide 32 bytes", () => {
    const anterior = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from("demasiado-corta").toString("base64");

    assert.throws(() => encrypt("x"), /32 bytes/);
    process.env.ENCRYPTION_KEY = anterior;
  });
});
