import { test, expect } from "@playwright/test";
import { adminClient, login } from "./helpers";
import { createTestOrg, destroyTestOrg, type TestOrg } from "./fixtures";

test.describe.configure({ mode: "serial" });

let org: TestOrg;
const courseTitle = `Curso de prueba E2E ${Date.now()}`;

test.beforeAll(async () => {
  org = await createTestOrg({ namePrefix: "Escuela Curso y Marca" });
});

test.afterAll(async () => {
  await destroyTestOrg(org);
});

test("crear un curso bloquea envíos duplicados y lo deja privado", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await login(page, org.owner.email, org.owner.password, org.prefix);

  await page.goto("/admin/cursos");
  await page.getByLabel("Título del nuevo curso").fill(courseTitle);
  await page.getByLabel("Precio").fill("49.90");
  await page.route("**/admin/cursos", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });

  const createButton = page.getByRole("button", { name: "Crear curso" });
  await createButton.click();
  await expect(page.getByRole("button", { name: "Creando curso…" })).toBeDisabled();

  await page.waitForURL(/\/admin\/cursos\/[0-9a-f-]+$/);

  const courseId = new URL(page.url()).pathname.split("/").at(-1)!;
  const admin = adminClient();
  const { data: section, error: sectionError } = await admin
    .from("sections")
    .insert({ course_id: courseId, title: "Capítulo responsive", order_index: 0 })
    .select("id")
    .single();
  if (sectionError || !section) throw sectionError ?? new Error("No se creó el capítulo.");
  const { error: lessonError } = await admin.from("lessons").insert({
    section_id: section.id,
    course_id: courseId,
    title: "Lección responsive",
    order_index: 0,
    blocks: [],
  });
  if (lessonError) throw lessonError;

  await page.reload();
  await page.setViewportSize({ width: 360, height: 800 });
  const curriculumOverflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map((element) => element.tagName)
  );
  expect(curriculumOverflow).toEqual([]);

  await page.goto("/admin/cursos");
  await expect(page.getByText(courseTitle)).toBeVisible();
  await expect(page.getByText("Privado", { exact: true })).toBeVisible();
  await expect(page.getByText(courseTitle)).toHaveCount(1);

  const courseCard = page.getByRole("article", { name: courseTitle });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(courseCard).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(courseCard.getByRole("button", { name: "Hacer público" })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      desktopMedia: window.matchMedia("(min-width: 768px)").matches,
      sidebarWidth: getComputedStyle(document.querySelector("aside")!).width,
    }))
  ).toEqual({ innerWidth: 390, desktopMedia: false, sidebarWidth: "64px" });
  const overflowingElements = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .slice(0, 10)
  );
  expect(overflowingElements).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("un curso puede hacerse público, privado y eliminarse con confirmación", async ({
  page,
}) => {
  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/cursos");

  const card = page.getByRole("article", { name: courseTitle });
  await card.getByRole("button", { name: "Hacer público" }).click();
  await expect(card.getByRole("button", { name: "Hacer privado" })).toBeVisible();

  await card.getByRole("button", { name: "Hacer privado" }).click();
  await expect(card.getByRole("button", { name: "Hacer público" })).toBeVisible();

  await card.getByRole("button", { name: "Eliminar curso", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Eliminar curso" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Eliminar curso" }).click();
  await expect(page.getByText(courseTitle)).toHaveCount(0);
});

test("un curso con ventas conserva el curso y el historial de compra", async ({ page }) => {
  const admin = adminClient();
  const soldCourseTitle = `Curso vendido E2E ${Date.now()}`;
  const { data: soldCourse, error: courseError } = await admin
    .from("courses")
    .insert({
      organization_id: org.orgId,
      title: soldCourseTitle,
      price: 29.9,
      status: "draft",
      description: "",
      learning_points: [],
    })
    .select("id")
    .single();
  if (courseError || !soldCourse) {
    throw courseError ?? new Error("No se creó el curso vendido.");
  }

  const { error: purchaseError } = await admin.from("purchases").insert({
    user_id: org.owner.id,
    course_id: soldCourse.id,
    organization_id: org.orgId,
    amount_paid: 29.9,
    payment_method: "stripe",
    external_reference: `e2e-sale-${Date.now()}`,
  });
  if (purchaseError) throw purchaseError;

  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/cursos");
  const card = page.getByRole("article", { name: soldCourseTitle });
  await card.getByRole("button", { name: "Eliminar curso", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Eliminar curso" });
  await dialog.getByRole("button", { name: "Eliminar curso" }).click();
  await expect(dialog).toContainText("tiene ventas y no se puede eliminar");
  await expect(card).toBeVisible();

  const directDelete = await admin.from("courses").delete().eq("id", soldCourse.id);
  expect(directDelete.error?.code).toBe("23503");
  const { count } = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("course_id", soldCourse.id);
  expect(count).toBe(1);
});

test("editar la marca cambia el nombre visible en el portal público", async ({ page }) => {
  const newName = `Marca Actualizada ${Date.now()}`;

  await login(page, org.owner.email, org.owner.password, org.prefix);
  await page.goto("/admin/marca");
  await page.getByLabel("Nombre", { exact: true }).fill(newName);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  await page.goto(org.prefix + "/");
  await expect(page.locator("header")).toContainText(newName);
});
