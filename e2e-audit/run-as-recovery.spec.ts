import { accounts, expect, test } from "./harness";
import type { Response } from "@playwright/test";
import { runAsFixtures } from "../scripts/audit-fixtures.mjs";

for (const scenario of ["purged", "logoutFailure", "inactive", "restorable", "auditFailure", "revocationFailure"] as const) {
  test(`Run as caducado: recuperación ${scenario} sin bucle`, async ({ page }) => {
    const account = Object.values(accounts).find(account => account?.id === runAsFixtures[scenario].id)!;
    const session = {
      access_token: account.token, refresh_token: `refresh.${account.token}`,
      token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+3600,
      user:{id:account.id,email:account.email},
    };
    const sessionCookie = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    const authCookies = scenario === "logoutFailure"
      ? [{name:"sb-127-auth-token.0",value:sessionCookie.slice(0,200)}, {name:"sb-127-auth-token.1",value:sessionCookie.slice(200)}, {name:"sb-127-auth-token-code-verifier",value:"synthetic-pkce"}]
      : [{name:"sb-127-auth-token",value:sessionCookie}];
    await page.context().addCookies([
      ...authCookies.map(cookie=>({...cookie,url:"http://localhost:3217"})),
      {name:"delunivo_run_as",value:`expired-support-marker-${scenario}`,url:"http://localhost:3217"},
      {name:"unrelated-preference",value:"keep",url:"http://localhost:3217"},
    ]);
    const navigations: string[] = [];
    const exitResponses: Response[] = [];
    const effectsUrl = "http://127.0.0.1:55473/__audit/run-as-effects";
    const effectsBefore = await (await page.request.get(effectsUrl)).json();
    page.on("request", request => { if(request.isNavigationRequest()) navigations.push(new URL(request.url()).pathname); });
    page.on("response", response => { if(new URL(response.url()).pathname === "/api/support/run-as/exit") exitResponses.push(response); });
    await page.goto("/");
    if (scenario === "restorable") {
      await expect(page).toHaveURL(/\/admin\/plataforma\?runAs=ended$/);
      await expect(page.getByRole("heading",{name:"Control de Delunivo"})).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/login\?runAs=expired$/);
      await expect(page.getByRole("heading",{name:"Inicia sesión en tu cuenta"})).toBeVisible();
      const exitCookieHeaders = (await Promise.all(exitResponses.map(response=>response.allHeaders()))).map(headers=>headers["set-cookie"] ?? "");
      for (const cookie of authCookies) {
        expect(exitCookieHeaders.join("\n")).toContain(`${cookie.name}=; Path=/; Expires=Thu, 01 Jan 1970`);
      }
      // Login's browser client can write an empty storage cookie afterwards.
      expect((await page.context().cookies()).filter(c=>c.name.startsWith("sb-127-auth-token") && c.value)).toEqual([]);
      await page.reload();
      await expect(page.getByRole("heading",{name:"Inicia sesión en tu cuenta"})).toBeVisible();
      if (["auditFailure","revocationFailure"].includes(scenario)) {
        const effectsAfter = await (await page.request.get(effectsUrl)).json();
        expect(effectsAfter.actorSessionValidations).toBe(effectsBefore.actorSessionValidations);
      }
    }
    expect(navigations.filter(path=>path==="/api/support/run-as/exit")).toHaveLength(1);
    const cookies = await page.context().cookies();
    expect(cookies.some(c=>c.name==="delunivo_run_as")).toBe(false);
    expect(cookies.find(c=>c.name==="unrelated-preference")?.value).toBe("keep");
  });
}

test("una salida forjada no cierra una sesión normal", async ({ page }) => {
  const account = accounts.superadmin;
  await page.context().addCookies([{name:"sb-127-auth-token",value:`base64-${Buffer.from(JSON.stringify({access_token:account.token,refresh_token:`refresh.${account.token}`,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:account.id,email:account.email}})).toString("base64url")}`,url:"http://localhost:3217"}]);
  const response = await page.request.get(`/api/support/run-as/exit?session=${runAsFixtures.purged.id}&proof=forged`,{maxRedirects:0});
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?runAs=invalid");
  await page.goto("/admin/plataforma");
  await expect(page.getByRole("heading",{name:"Control de Delunivo"})).toBeVisible();
});
