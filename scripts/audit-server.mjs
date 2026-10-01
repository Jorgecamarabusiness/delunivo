/**
 * Arranca Next contra un doble local de Supabase para la auditoría Playwright.
 * Neutraliza la configuración real; Next puede descargar fuentes al compilar.
 * Nunca representa una prueba de RLS/Postgres, Mux, Stripe o producción.
 */
import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { AUDIT_PORT, AUDIT_SUPABASE_PORT, accounts, accountForEmail, accountForToken, assetA, courseA, ids, lessonA, organizations, sectionA, userFor } from "./audit-fixtures.mjs";

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "http://localhost:" + AUDIT_PORT, "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", ...headers });
  response.end(JSON.stringify(body));
};
const tokenFrom = (request) => request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
const accountFrom = (request) => accountForToken(tokenFrom(request));
const readJson = async (request) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
};
const isAdmin = (account, orgId) => Boolean(account && (account.id === ids.superadmin || (orgId === ids.orgA && account.id === ids.ownerA) || (orgId === ids.orgB && account.id === ids.ownerB)));
const isStudent = (account, orgId) => Boolean(account && [ids.studentA, "20000000-0000-4000-8000-000000000005"].includes(account.id) && orgId === ids.orgA);

function rowsFor(table, query, account) {
  // PostgREST serializa `.eq("id", value)` como `id=eq.value`.
  const eq = (name) => {
    const value = query.get(name) ?? query.get(`eq.${name}`);
    return value?.startsWith("eq.") ? value.slice(3) : value;
  };
  switch (table) {
    case "organizations": return eq("slug") === organizations.orgA.slug ? [organizations.orgA] : eq("slug") === organizations.orgB.slug ? [organizations.orgB] : eq("id") === ids.orgA ? [organizations.orgA] : eq("id") === ids.orgB ? [organizations.orgB] : [organizations.orgA,organizations.orgB];
    case "profiles": return Object.values(accounts).filter(Boolean).map(a => ({ id: a.id, name: a.email.split("@")[0], email: a.email, is_super_admin: a.id === ids.superadmin, account_status: "active" })).filter(row => !eq("id") || row.id === eq("id"));
    case "courses": return (!eq("id") || eq("id") === ids.courseA) ? [courseA] : [];
    case "sections": return (!eq("course_id") || eq("course_id") === ids.courseA) ? [sectionA] : [];
    case "lessons": return (!eq("id") || eq("id") === ids.lessonA) && (!eq("course_id") || eq("course_id") === ids.courseA) ? [lessonA] : [];
    case "video_assets": return (!eq("id") || eq("id") === ids.assetA) ? [assetA] : [];
    case "purchases": return account?.id === ids.studentA && (!eq("course_id") || eq("course_id") === ids.courseA) ? [{ id: "70000000-0000-4000-8000-000000000001" }] : [];
    // La tabla real no tiene organization_id: no inventar columnas en fixtures.
    case "student_course_access": return [ids.studentA, "20000000-0000-4000-8000-000000000005"].includes(account?.id) ? [{ course_id: ids.courseA }] : [];
    case "video_views": return [];
    case "organization_admins": return account?.id===ids.ownerA || account?.id===ids.superadmin ? [{ id: "80000000-0000-4000-8000-000000000001", organization_id: ids.orgA,role:"owner",user_id:ids.ownerA,created_at:"2026-09-01T00:00:00Z" }] : account?.id===ids.ownerB ? [{organization_id:ids.orgB,role:"owner",user_id:ids.ownerB,created_at:"2026-09-01T00:00:00Z"}] : [];
    case "organization_students": return isStudent(account, ids.orgA) ? [{ organization_id: ids.orgA, user_id: account.id, status: "active" }] : [];
    case "organization_billing": return [{ organization_id:eq("organization_id") ?? ids.orgA, platform_subscription_status: "active",offer_version:"2026-10-01",plan_key:"crece",quota_mode:"enforce",accepted_offer:{name:"Crece"},library_limit_seconds:180000,economic_limit_seconds:216000,library_extension_quantity:0,platform_subscription_id:"sub_synthetic",platform_stripe_customer_id:"cus_synthetic",access_mode:"standard",effective_discount_percent:20 }];
    case "platform_capacity_cycles": return [{id:"81000000-0000-4000-8000-000000000001",organization_id:ids.orgA,starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+29*86400000).toISOString(),base_seconds:480000,grace_seconds:48000,base_used_seconds:12000,grace_used_seconds:0}];
    case "mux_asset_ledger": return [{video_asset_id:ids.assetA,organization_id:ids.orgA,environment:"audit-env",duration_seconds:60}];
    case "platform_billing_operations": return [{id:"82000000-0000-4000-8000-000000000001",organization_id:ids.orgA,kind:"delivery_pack",status:"pending_payment",created_at:new Date().toISOString(),quote:{},checkout_attempt_id:"synthetic-attempt"}];
    case "platform_delivery_packs": return [{id:"83000000-0000-4000-8000-000000000001",organization_id:ids.orgA,granted_seconds:300000,used_seconds:6000,starts_at:new Date().toISOString(),expires_at:new Date(Date.now()+90*86400000).toISOString()}];
    case "platform_settings": return [];
    default: return [];
  }
}

async function mockSupabase(request, response) {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url, `http://127.0.0.1:${AUDIT_SUPABASE_PORT}`);
  const account = accountFrom(request);
  if (url.pathname === "/auth/v1/user") return account ? json(response, 200, userFor(account)) : json(response, 401, { message: "invalid JWT" });
  if (url.pathname === "/auth/v1/token" && request.method === "POST") {
    const body = await readJson(request);
    const isRefresh = url.searchParams.get("grant_type") === "refresh_token";
    const found = isRefresh
      ? Object.values(accounts).find((candidate) => candidate && body.refresh_token?.includes(candidate.token))
      : accountForEmail(body.email);
    if (!found || (!isRefresh && found.password !== body.password)) return json(response, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    return json(response, 200, { access_token: found.token, refresh_token: `refresh.${found.token}`, token_type: "bearer", expires_in: 3600, user: userFor(found) });
  }
  if (url.pathname.startsWith("/auth/v1/")) return json(response, 200, {});
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const body = await readJson(request);
    const rpc = url.pathname.split("/").pop();
    if(rpc==="platform_library_usage") return json(response,200,{active_seconds:60000,reserved_seconds:300,committed_seconds:3600,unconfirmed_assets:1,release_at:new Date(Date.now()+86400000).toISOString()});
    if(rpc==="platform_recent_delivery_estimate") return json(response,200,120);
    if(rpc==="platform_school_storage") return json(response,200,[]);
    if(rpc==="admit_platform_playback") return json(response,200,{allowed:true,sessionId:"84000000-0000-4000-8000-000000000001",expiresAt:new Date(Date.now()+960000).toISOString()});
    const orgId = body.org_id;
    const result = rpc === "current_account_is_active" ? Boolean(account) : rpc === "is_org_admin" ? isAdmin(account, orgId) : rpc === "is_org_owner" ? Boolean(account && (account.id === ids.superadmin || (account.id === ids.ownerA && orgId === ids.orgA) || (account.id === ids.ownerB && orgId === ids.orgB))) : rpc === "is_org_student" ? isStudent(account, orgId) : rpc === "has_course_access" ? Boolean(account && [ids.studentA, "20000000-0000-4000-8000-000000000005", ids.ownerA, ids.superadmin].includes(account.id) && body.target_course_id === ids.courseA) : rpc === "has_org_platform_access" ? orgId === ids.orgA || orgId === ids.orgB : rpc === "is_super_admin" ? account?.id === ids.superadmin : null;
    return json(response, 200, result);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
    if (table === "student_course_access" && url.searchParams.has("organization_id")) {
      return json(response, 400, { code: "42703", message: "column student_course_access.organization_id does not exist" });
    }
    const rows = rowsFor(table, url.searchParams, account);
    if (request.headers.accept?.includes("application/vnd.pgrst.object+json")) {
      return rows.length === 1 ? json(response, 200, rows[0]) : json(response, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    }
    return json(response, 200, rows, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  }
  return json(response, 404, { error: "audit mock route not found" });
}

const server = createServer((request, response) => void mockSupabase(request, response));
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
// No se propaga el entorno del usuario: .env.local puede contener producción.
// Se neutralizan también todos los nombres declarados en .env*, sin exponer
// valores; Next no sustituye una variable ya presente, aunque esté vacía.
const dotenvNames = new Set();
for (const file of readdirSync(process.cwd()).filter((name) => name.startsWith(".env"))) {
  for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) dotenvNames.add(match[1]);
  }
}
const blankDotenv = Object.fromEntries([...dotenvNames].map((name) => [name, ""]));
// Sólo se conserva lo imprescindible para localizar node/npm en cada SO.
const runtimeEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  /^(PATH|Path|SYSTEMROOT|SystemRoot|WINDIR|ComSpec|PATHEXT|TEMP|TMP|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|HOME|HOMEDRIVE|HOMEPATH|OS|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS|CI)$/.test(name)
));
const auditEnv = {
  ...runtimeEnv,
  ...blankDotenv,
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${AUDIT_PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${AUDIT_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "audit-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "audit-service-role-key",
  IMPERSONATION_SESSION_KEY: Buffer.alloc(32, 7).toString("base64"),
  MUX_TOKEN_ID: "",
  MUX_TOKEN_SECRET: "",
  MUX_WEBHOOK_SECRET: "audit-mux-webhook-secret",
  MUX_SIGNING_KEY: "audit-mux-signing-key",
  MUX_PRIVATE_KEY: privateKey,
  MUX_DELETION_MODE: "off",
  EMAIL_DELIVERY_MODE: "off",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
  STRIPE_SECRET_KEY: "sk_test_audit_fixture_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "",
  STRIPE_CONNECT_WEBHOOK_SECRET: "",
  CRON_SECRET: "",
  PLATFORM_PLANS_ENABLED:"true",
  MUX_ENVIRONMENT_ID:"audit-env",
};

function runNext(args, env = auditEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { stdio: "inherit", env });
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`next ${args.join(" ")} terminó con ${code}`)));
  });
}
let next;
function stop() { if (next) next.kill("SIGTERM"); server.close(); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
server.listen(AUDIT_SUPABASE_PORT, "127.0.0.1", async () => {
  try {
    if (process.argv.includes("build")) {
      await runNext(["build"]);
      server.close();
      return;
    }
    const serverEnv = { ...auditEnv, NODE_OPTIONS: `--require=${resolve(process.cwd(), "scripts/audit-network-guard.cjs")}` };
    next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(AUDIT_PORT), "-H", "localhost"], { stdio: "inherit", env: serverEnv });
    next.once("exit", (code) => { server.close(); process.exitCode = code ?? 1; });
  } catch (error) { console.error(error); stop(); process.exitCode = 1; }
});
