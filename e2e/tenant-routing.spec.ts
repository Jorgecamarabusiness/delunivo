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

test("el dominio raíz sin prefijo es la landing de Aularia, sin branding de ningún cliente", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Empieza a vender tus cursos con Aularia/i })
  ).toBeVisible();
  // El alta de empresa vive en /crear-empresa; la portada solo la enlaza.
  await expect(page.getByRole("link", { name: "Crear mi empresa" }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(orgA.slug);
  await expect(page.locator("body")).not.toContainText(orgB.slug);
});

test("el formulario de alta de empresa vive en /crear-empresa", async ({ page }) => {
  await page.goto("/crear-empresa");
  await expect(page.getByLabel("Nombre de tu empresa")).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: /Empieza a vender tus cursos con Aularia/i })
  ).toBeVisible();
});

test("ningún Host se interpreta como subdominio de cliente: la empresa solo sale de la ruta", async ({
  request,
  baseURL,
}) => {
  // src/proxy.ts ya no mira el Host para nada — la empresa se resuelve solo por
  // /o/<slug>. Esto lo fija: da igual qué Host llegue, el dominio raíz siempre
  // enseña la landing de Aularia y nunca el portal de un cliente.
  for (const host of ["aularia.vercel.app", "escuela-alfa.aularia.app", host_of(orgA)]) {
    const response = await request.get(baseURL + "/", { headers: { host } });
    expect(response.status()).toBeLessThan(500);
    expect(await response.text()).toContain("Empieza a vender tus cursos con Aularia");
  }
});

function host_of(org: TestOrg): string {
  return `${org.slug}.aularia.app`;
}
