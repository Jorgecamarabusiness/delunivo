import { test, expect } from "@playwright/test";
import { ACCOUNTS, MAIN_COURSE_ID, login } from "./helpers";

const VIDEO_ASSET_ID = "33333333-3333-4333-8333-333333333333";

test("la UI envía el archivo al endpoint directo de Mux y no al backend", async ({
  page,
}) => {
  let controlRequest: unknown = null;
  let muxUploadBytes = 0;

  await page.route("**/api/admin/mux/uploads", async (route) => {
    controlRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        videoAssetId: VIDEO_ASSET_ID,
        uploadId: "mock-upload-id",
        uploadUrl: "http://localhost:3100/__mock_mux_direct_upload",
      }),
    });
  });

  await page.route("**/__mock_mux_direct_upload", async (route) => {
    muxUploadBytes += route.request().postDataBuffer()?.byteLength ?? 0;
    await route.fulfill({ status: 200, body: "" });
  });

  await page.route(`**/api/admin/mux/video-assets/${VIDEO_ASSET_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: VIDEO_ASSET_ID,
        status: "processing",
        errorMessage: null,
      }),
    });
  });

  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto(`/admin/cursos/${MAIN_COURSE_ID}`);
  // El primer menú pertenece a la sección; el segundo, a su primera lección.
  await page.getByRole("button", { name: "Más opciones" }).nth(1).click();
  await page.getByRole("link", { name: "Editar contenido" }).click();
  await page.getByRole("button", { name: "+ Añadir contenido" }).click();
  await page.getByRole("button", { name: "Vídeo", exact: true }).click();

  await page.getByLabel("Título").fill("Vídeo Mux simulado");
  await page.locator("mux-uploader input[type=file]").setInputFiles({
    name: "sample-1080p.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(128 * 1024, 1),
  });

  await expect(page.getByText("Progreso de carga: 100%")).toBeVisible();
  await expect(page.getByText(/Mux está procesando el vídeo/)).toBeVisible();
  expect(controlRequest).toMatchObject({
    lessonId: expect.any(String),
    blockId: expect.any(String),
    fileSize: 128 * 1024,
    mimeType: "video/mp4",
  });
  expect(JSON.stringify(controlRequest)).not.toContain("sample-1080p.mp4");
  expect(muxUploadBytes).toBe(128 * 1024);

  // No se pulsa "Añadir": esta prueba no muta la lección ni Supabase.
});
