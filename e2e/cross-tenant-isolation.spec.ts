import { test, expect } from "@playwright/test";
import { login, adminClient } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

// Regresión del bug real encontrado en la Fase 4: la policy de "courses"
// permite leer cualquier fila published de CUALQUIER organización (a
// propósito, la necesita el sitio público) — /admin/cursos y
// /admin/estadisticas tienen que filtrar por organization_id en código, RLS
// no lo hace por ellos. Ver docs/database.md, "Fase 4".

let orgA: TestOrg;
let orgB: TestOrg;
const courseTitle = `Curso exclusivo de Org A ${Date.now()}`;
let courseId: string;

test.beforeAll(async () => {
  [orgA, orgB] = await Promise.all([createTestOrg(), createTestOrg()]);

  const admin = adminClient();
  const { data: course, error } = await admin
    .from("courses")
    .insert({
      organization_id: orgA.orgId,
      title: courseTitle,
      price: 9.99,
      status: "published",
      description: "",
      learning_points: [],
    })
    .select("id")
    .single();
  if (error || !course) throw error ?? new Error("No se pudo crear el curso E2E.");
  courseId = course.id;
});

test.afterAll(async () => {
  await Promise.all([destroyTestOrg(orgA), destroyTestOrg(orgB)]);
});

test("un admin de la organización B no ve los cursos publicados de la organización A en /admin/cursos", async ({
  page,
}) => {
  await login(page, orgB.owner.email, orgB.owner.password, orgB.prefix);
  await page.goto("/admin/cursos");
  await expect(page.locator("body")).not.toContainText(courseTitle);
  await expect(page.getByText("Todavía no hay cursos.")).toBeVisible();
});

test("un admin de la organización B no ve los cursos publicados de la organización A en /admin/estadisticas", async ({
  page,
}) => {
  await login(page, orgB.owner.email, orgB.owner.password, orgB.prefix);
  await page.goto("/admin/estadisticas");
  await expect(page.locator("body")).not.toContainText(courseTitle);
  await expect(page.getByText("Todavía no hay cursos publicados.")).toBeVisible();
});

test("el propio admin de la organización A sí ve su curso en /admin/cursos", async ({ page }) => {
  await login(page, orgA.owner.email, orgA.owner.password, orgA.prefix);
  await page.goto("/admin/cursos");
  await expect(page.getByText(courseTitle)).toBeVisible();
});

test("el aula de un curso no se puede renderizar bajo la marca de otra organización", async ({
  page,
}) => {
  await login(page, orgA.owner.email, orgA.owner.password, orgA.prefix);
  await page.goto(`/o/${orgB.slug}/cursos/${courseId}/aprender`);

  await expect(page.getByText("Curso no encontrado.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(courseTitle);
});
