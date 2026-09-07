import { captureResponsive, expect, ids, login, test } from "./harness";

test("portada y login se renderizan sólo con servicios locales y deja capturas responsive", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Delunivo/i);
  await expect(page.getByRole("heading", { name: "Crea, vende y comparte conocimiento." })).toBeVisible();
  await captureResponsive(page, testInfo);
  await page.goto("/o/audit-org-a/login");
  await expect(page.getByRole("heading", { name: /inicia sesión/i })).toBeVisible();
});

test("una ruta inexistente responde HTTP 404 sin tratar el documento esperado como error de consola", async ({ page }) => {
  const response = await page.request.get("/ruta-que-no-existe-audit");
  expect(response.status()).toBe(404);
});

test("la cabecera x-org-slug forjada no convierte la raíz en un portal de organización", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-org-slug": "audit-org-a" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Crea, vende y comparte conocimiento." })).toBeVisible();
  await expect(page.getByText("Escuela A sintética")).not.toBeVisible();
  await page.setExtraHTTPHeaders({});
});

test("playback exige identidad y no permite que owner B cruce a organización A", async ({ page }) => {
  let response = await page.request.get(`/api/video/${ids.assetA}/playback?check=1`);
  expect(response.status()).toBe(401);
  await login(page, "ownerB");
  response = await page.request.get(`/api/video/${ids.assetA}/playback?check=1`);
  expect(response.status()).toBe(403);
  await login(page, "studentA");
  response = await page.request.get(`/api/video/${ids.assetA}/playback?check=1`);
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ authorized: true });
});

test("owner B no puede iniciar una subida Mux asociada a una lección de A", async ({ page }) => {
  await login(page, "ownerB");
  const response = await page.request.post("/api/admin/mux/uploads", {
    headers: { origin: "http://localhost:3217" },
    data: { lessonId: ids.lessonA, blockId: ids.blockA, fileSize: 512, mimeType: "video/webm" },
  });
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/permisos/i) });
});

test("una alumna invitada sin compra puede abrir el aula, mientras el editor exige owner", async ({ page }, testInfo) => {
  await login(page, "studentInvited");
  // No solicitar medios reales de Mux: la autorización se comprueba abajo por HTTP.
  testInfo.annotations.push({ type: "expected-http-409", description: `http://localhost:3217/api/video/${ids.assetA}/playback` });
  await page.route(`**/api/video/${ids.assetA}/playback`, (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ status: "processing" }) }));
  await page.goto(`/o/audit-org-a/cursos/${ids.courseA}/aprender?lesson=${ids.lessonA}`);
  await expect(page.getByRole("heading", { name: "Lección de vídeo" })).toBeVisible();
  await expect(page.getByText("El vídeo todavía se está procesando…")).toBeVisible();
  const playback = await page.request.get(`/api/video/${ids.assetA}/playback?check=1`);
  expect(playback.status()).toBe(200);
  await expect(playback.json()).resolves.toMatchObject({ authorized: true });
  await page.goto(`/o/audit-org-a/admin/cursos/${ids.courseA}/lecciones/${ids.lessonA}`);
  await expect(page).toHaveURL("http://localhost:3217/");
  await expect(page.getByText("Contenido de la lección")).not.toBeVisible();
  await login(page, "ownerA");
  await page.goto(`/o/audit-org-a/admin/cursos/${ids.courseA}/lecciones/${ids.lessonA}`);
  await expect(page.getByRole("heading", { name: "Lección de vídeo" })).toBeVisible();
  await expect(page.getByText("Contenido de la lección")).toBeVisible();
  await page.waitForLoadState("networkidle");
});

test("el borrado global propio y la ficha legal de escuela se revisan en tres anchos", async ({ page }, testInfo) => {
  await login(page, "studentA");
  await page.goto("/cuenta/eliminar");
  await expect(page.getByRole("heading", { name: "Eliminar mi cuenta" })).toBeVisible();
  await expect(page.getByText(/en todas las escuelas de Delunivo/)).toBeVisible();
  await captureResponsive(page, testInfo, "account-deletion");
  await login(page, "ownerA");
  await page.goto("/o/audit-org-a/admin/marca");
  await expect(page.getByRole("heading", { name: "Vendedor y contacto público" })).toBeVisible();
  await captureResponsive(page, testInfo, "seller-legal");
});

test("el panel de subida mantiene el vídeo en processing y no carga proveedores", async ({ page }, testInfo) => {
  let assetReady = false;
  await login(page, "ownerA");
  await page.goto(`/o/audit-org-a/admin/cursos/${ids.courseA}/lecciones/${ids.lessonA}`);
  await page.getByRole("button", { name: "+ Añadir contenido" }).click();
  await page.getByRole("button", { name: "Vídeo", exact: true }).click();
  await page.route("**/api/admin/mux/uploads", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ videoAssetId: ids.assetA, uploadId: "audit-upload", uploadUrl: "http://localhost:3217/__audit_mux_chunks" }) }));
  await page.route("**/__audit_mux_chunks", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route(`**/api/admin/mux/video-assets/${ids.assetA}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ids.assetA, status: assetReady ? "ready" : "processing", errorMessage: null }) }));
  await page.locator("mux-uploader input[type=file]").setInputFiles("e2e-audit/fixtures/sintel-trailer.mp4");
  await expect(page.getByText(/Esperando la verificación y el procesamiento/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Añadir|Guardar/ })).toBeDisabled();
  await captureResponsive(page, testInfo, "video-upload-processing");
  assetReady = true;
  await expect(page.getByText("Vídeo listo")).toBeVisible({ timeout: 7_000 });
  await expect(page.getByRole("button", { name: /Añadir|Guardar/ })).toBeEnabled();
  // No se pulsa guardar: esta prueba no modifica la lección ni el proveedor.
});

test("administración y seguimiento de cuentas conservan navegación responsive", async ({ page }, testInfo) => {
  await login(page, "ownerA");
  await page.goto("/o/audit-org-a/admin");
  await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
  await captureResponsive(page, testInfo, "admin-home");
  await login(page, "superadmin");
  await page.goto("/admin/plataforma/cuentas");
  await expect(page.getByRole("heading", { name: "Cuentas", exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar por correo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eliminaciones en curso" })).toBeVisible();
  await captureResponsive(page, testInfo, "platform-accounts");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animation = await page.getByRole("heading", { name: "Cuentas", exact: true }).evaluate(element => getComputedStyle(element).animationDuration);
  expect(animation).toBe("1e-05s");
});
