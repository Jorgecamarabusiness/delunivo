import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { appFixture } from "./fixtures";
const org = "71000000-0000-4000-8000-000000000001",
  asset = "71000000-0000-4000-8000-000000000004";
async function login(page: Page, email: string, password: string) {
  await page.goto("/o/capacity-app/login");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contrase/i).fill(password);
  await page.getByRole("button", { name: /iniciar sesi/i }).click();
  await page.waitForURL(/\/cursos|\/admin/);
}
test("consumidor real conserva sesión de 12 horas al agotar cuota, recupera admisión y revoca permisos; owner exporta Storage", async ({
  page,
  context,
}) => {
  await context.route("**/*", (route) =>
    ["localhost", "127.0.0.1", "::1"].includes(
      new URL(route.request().url()).hostname,
    )
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await login(page, appFixture.learner.email, appFixture.learner.password);
  const initial = await page.request.get(`/api/video/${asset}/playback`);
  expect(initial.status()).toBe(200);
  const grant = await initial.json();
  const tokenPayload = JSON.parse(
    Buffer.from(grant.token.split(".")[1], "base64url").toString(),
  );
  expect(tokenPayload.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(
    44000,
  );
  execFileSync(process.execPath, [
    "scripts/isolated-capacity-consumer-state.mjs",
    "exhaust",
  ]);
  expect(
    (await page.request.get(`/api/video/${asset}/playback`)).status(),
  ).toBe(402);
  const existing = await page.request.get(
    `/api/video/${asset}/playback?session=${grant.sessionId}`,
  );
  expect(existing.status()).toBe(200);
  expect((await existing.json()).expiresAt).toBe(grant.expiresAt);
  expect(
    (
      await page.request.get(`/api/admin/content-export?organizationId=${org}`)
    ).status(),
  ).toBe(403);
  execFileSync(process.execPath, [
    "scripts/isolated-capacity-consumer-state.mjs",
    "restore",
  ]);
  expect(
    (await page.request.get(`/api/video/${asset}/playback`)).status(),
  ).toBe(200);
  execFileSync(process.execPath, [
    "scripts/isolated-capacity-consumer-state.mjs",
    "revoke",
  ]);
  expect(
    (
      await page.request.get(
        `/api/video/${asset}/playback?session=${grant.sessionId}&check=1`,
      )
    ).status(),
  ).toBe(403);
  await context.clearCookies();
  await login(
    page,
    "capacity-app-owner@synthetic.invalid",
    "Synthetic-capacity-owner-123!",
  );
  await page.goto("/admin/facturacion");
  await expect(
    page.getByRole("heading", { name: /Consumo y capacidad/ }),
  ).toBeVisible();
  const exported = await page.request.get(
    `/api/admin/content-export?organizationId=${org}`,
  );
  expect(exported.status()).toBe(200);
  const manifest = await exported.json();
  expect(manifest.organization.id).toBe(org);
  expect(manifest.purchases).toBeUndefined();
  const media = manifest.media.find(
    (m: { kind: string; available: boolean }) =>
      m.kind === "storage" && m.available,
  );
  expect(media).toBeTruthy();
  const downloaded = await page.request.get(media.url);
  expect(downloaded.status()).toBe(200);
  expect(await downloaded.text()).toBe("Only synthetic creator content.");
  expect(
    (
      await page.request.get(
        "/api/admin/content-export?organizationId=60000000-0000-4000-8000-000000000001",
      )
    ).status(),
  ).toBe(403);
  await page.goto("/a-medida");
  await page
    .getByLabel("Tus necesidades")
    .fill("Solicitud sintética sobre la capacidad necesaria.");
  await page.getByRole("button", { name: "Registrar solicitud" }).click();
  await expect(page.getByRole("alert")).toContainText("Solicitud registrada");
});
