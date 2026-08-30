import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDeliveryMode } from "./deliveryMode.ts";

describe("resolveDeliveryMode — entrega segura según el entorno", () => {
  it("envía a destinatarios reales en la producción de Delunivo", () => {
    assert.equal(resolveDeliveryMode(undefined, "production", true), "live");
    assert.equal(resolveDeliveryMode("redirect", "production", true), "live");
  });

  it("mantiene la redirección segura si producción aún no tiene remitente", () => {
    assert.equal(resolveDeliveryMode(undefined, "production", false), "redirect");
  });

  it("redirige a correos de prueba por defecto fuera de producción", () => {
    assert.equal(resolveDeliveryMode(undefined, "development"), "redirect");
    assert.equal(resolveDeliveryMode(undefined, undefined), "redirect");
  });

  it("permite entrega real explícita en un entorno no productivo", () => {
    assert.equal(resolveDeliveryMode("live", "preview"), "live");
  });

  it("respeta el apagado de emergencia incluso en producción", () => {
    assert.equal(resolveDeliveryMode("off", "production", true), "off");
  });
});
