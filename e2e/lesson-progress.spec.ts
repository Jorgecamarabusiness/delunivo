import { test, expect } from "@playwright/test";
import { login, adminClient, ACCOUNTS, MAIN_COURSE_ID, IVANORGANICO_PREFIX } from "./helpers";

// El progreso del alumno vive en `video_views` (una fila = lección completada).
// Hasta el 2026-08-11 no lo escribía nadie: el "% completado" era un useState y
// se perdía al recargar, mientras /admin/estadisticas leía filas antiguas que
// ya no crecían. Estos tests fijan que ahora persiste de verdad.

const LESSON_URL = `${IVANORGANICO_PREFIX}/cursos/${MAIN_COURSE_ID}/aprender`;

// Los dos casos comparten la misma cuenta y limpian la misma tabla.
test.describe.configure({ mode: "serial" });

let studentId: string;

test.beforeAll(async () => {
  const admin = adminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", ACCOUNTS.student.email)
    .single();
  studentId = data!.id;
});

test.beforeEach(async () => {
  // Se parte siempre de cero: los tests corren en paralelo con otros specs pero
  // ninguno más toca el progreso de esta cuenta.
  await adminClient().from("video_views").delete().eq("user_id", studentId);
});

test.afterAll(async () => {
  await adminClient().from("video_views").delete().eq("user_id", studentId);
});

test("marcar una lección la guarda y sobrevive a recargar la página", async ({
  page,
}) => {
  await login(page, ACCOUNTS.student.email, ACCOUNTS.student.password);
  await page.goto(LESSON_URL);

  const marcar = page
    .getByRole("button", { name: "Marcar lección como completada" })
    .first();
  await marcar.click();

  // El guardado va en segundo plano: se espera a que la fila exista de verdad.
  await expect(async () => {
    const { count } = await adminClient()
      .from("video_views")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", studentId);
    expect(count).toBe(1);
  }).toPass({ timeout: 10_000 });

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Marcar lección como pendiente" }).first()
  ).toBeVisible();
});

test("desmarcar una lección la borra de verdad, no solo en pantalla", async ({
  page,
}) => {
  await login(page, ACCOUNTS.student.email, ACCOUNTS.student.password);
  await page.goto(LESSON_URL);

  await page
    .getByRole("button", { name: "Marcar lección como completada" })
    .first()
    .click();
  const pendiente = page
    .getByRole("button", { name: "Marcar lección como pendiente" })
    .first();
  await expect(pendiente).toBeVisible();

  await pendiente.click();

  // Antes de la policy de DELETE, esto no daba error pero tampoco borraba: la
  // pantalla se quedaba desmarcada y la fila seguía en la base de datos.
  await expect(async () => {
    const { count } = await adminClient()
      .from("video_views")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", studentId);
    expect(count).toBe(0);
  }).toPass({ timeout: 10_000 });

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Marcar lección como completada" }).first()
  ).toBeVisible();
});
