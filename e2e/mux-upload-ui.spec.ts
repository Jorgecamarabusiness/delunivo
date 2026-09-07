import { test, expect } from "@playwright/test";
import { statSync } from "node:fs";
import { ACCOUNTS, MAIN_COURSE_ID, login } from "./helpers";

const VIDEO_ASSET_ID = "33333333-3333-4333-8333-333333333333";

test("la UI envía el archivo al endpoint directo de Mux y no al backend", async ({
  page,
}) => {
  let controlRequest: unknown = null;
  let muxUploadBytes = 0;
  let assetReady = false;
  const fixturePath = "e2e-audit/fixtures/sintel-trailer.mp4";
  const fixtureBytes = statSync(fixturePath).size;

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
        status: assetReady ? "ready" : "processing",
        errorMessage: null,
      }),
    });
  });

  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto(`/admin/cursos/${MAIN_COURSE_ID}`);
  await page.getByRole("link", { name: "Editar contenido" }).first().click();
  await page.getByRole("button", { name: "+ Añadir contenido" }).click();
  await page.getByRole("button", { name: "Vídeo", exact: true }).click();

  await page.getByLabel("Título").fill("Vídeo Mux simulado");
  await expect(page.getByRole("button", { name: "Añadir", exact: true })).toBeDisabled();
  await page.locator("mux-uploader input[type=file]").setInputFiles(fixturePath);

  await expect(page.getByText(/Esperando la verificación y el procesamiento/)).toBeVisible();
  assetReady = true;
  await expect(page.getByText("Vídeo listo")).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText(/Último paso:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Añadir", exact: true })).toBeEnabled();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText(/Previsualización local del archivo elegido/)).toBeVisible();
  await expect(page.getByText(/Después sí puedes salir/)).toBeVisible();
  expect(controlRequest).toMatchObject({
    lessonId: expect.any(String),
    blockId: expect.any(String),
    fileSize: fixtureBytes,
    mimeType: "video/mp4",
  });
  expect(JSON.stringify(controlRequest)).not.toContain("sintel-trailer.mp4");
  expect(muxUploadBytes).toBe(fixtureBytes);

  // No se pulsa "Añadir": esta prueba no muta la lección ni Supabase.
});
