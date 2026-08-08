import { test, expect } from "@playwright/test";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

// Cobertura mínima de la Fase 10 (ver docs/database.md, "Enrutamiento por
// RUTA"): la organización se resuelve por /o/<slug>, nunca por el dominio
// raíz, y un slug desconocido o un Host mal interpretado no debe filtrar el
// branding de ningún cliente real.

let orgA: TestOrg;
let orgB: TestOrg;

test.beforeAll(async () => {
  [orgA, orgB] = await Promise.all([
    createTestOrg({ namePrefix: "Escuela Alfa" }),
    createTestOrg({ namePrefix: "Escuela Beta" }),
  ]);
});

test.afterAll(async () => {
  await Promise.all([destroyTestOrg(orgA), destroyTestOrg(orgB)]);
});

test("el dominio raíz sin prefijo es la landing de registro de empresas, sin branding de ningún cliente", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Crea tu escuela online con Aularia/i })).toBeVisible();
  await expect(page.getByLabel("Nombre de tu empresa")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(orgA.slug);
  await expect(page.locator("body")).not.toContainText(orgB.slug);
});

test("/o/<slug> muestra el branding propio de esa organización, no el de otra", async ({ page }) => {
  await page.goto(orgA.prefix + "/");
  await expect(page.locator("header")).toContainText(/Escuela Alfa/);
  await expect(page.locator("header")).not.toContainText(/Escuela Beta/);

  await page.goto(orgB.prefix + "/");
  await expect(page.locator("header")).toContainText(/Escuela Beta/);
  await expect(page.locator("header")).not.toContainText(/Escuela Alfa/);
});

test("un slug de organización inexistente cae a la landing genérica, no rompe ni filtra otro cliente", async ({
  page,
}) => {
  const response = await page.goto("/o/no-existe-" + Date.now() + "/");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: /Crea tu escuela online con Aularia/i })).toBeVisible();
});

test("un Host *.vercel.app nunca se interpreta como subdominio de cliente (regresión del bug de despliegue)", async ({
  request,
  baseURL,
}) => {
  // Antes de la corrección en src/proxy.ts, "aularia.vercel.app" se parseaba
  // igual que "cliente1.aularia.app" y trataba "aularia" como si fuera el
  // slug de un cliente inexistente. Se simula con un Host falsificado en una
  // request cruda al servidor local, igual que se verificó a mano con curl.
  const response = await request.get(baseURL + "/", {
    headers: { host: "aularia.vercel.app" },
  });
  expect(response.status()).toBeLessThan(500);
  const body = await response.text();
  expect(body).toContain("Crea tu escuela online con Aularia");
});
