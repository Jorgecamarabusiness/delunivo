import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, MAIN_COURSE_ID, IVANORGANICO_PREFIX } from "./helpers";

test("si la lección tiene un vídeo subido, su URL nunca es pública", async ({ page }) => {
  await login(page, ACCOUNTS.student.email, ACCOUNTS.student.password);
  await page.goto(`${IVANORGANICO_PREFIX}/cursos/${MAIN_COURSE_ID}/aprender`);

  const video = page.locator("video").first();
  const count = await video.count();

  test.skip(
    count === 0,
    "El curso todavía no tiene ningún bloque 'video_file' subido — nada que comprobar. " +
      "Sube un vídeo a una lección y vuelve a correr este test."
  );

  const src = await video.getAttribute("src");
  expect(src).toBeTruthy();
  // Nunca debe volver a ser una URL pública del bucket.
  expect(src).not.toContain("/object/public/");
  // Debe ser una URL firmada (con token de corta duración).
  expect(src).toMatch(/\/object\/sign\/.*token=/);
});
