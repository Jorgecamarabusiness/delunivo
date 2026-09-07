/** Starts a real local Next process against the Supabase stack already started by CI. */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const port = 3219;
const { apiUrl, anonKey, serviceRoleKey } = localSupabase();
const fixture = {
  org: "60000000-0000-4000-8000-000000000001",
  owner: "60000000-0000-4000-8000-000000000002",
  free: "70000000-0000-4000-8000-000000000001",
  paid: "70000000-0000-4000-8000-000000000002",
  draft: "70000000-0000-4000-8000-000000000003",
  learner: ["app-e2e-learner@synthetic.invalid", "Synthetic-app-learner-123!"],
  removed: ["app-e2e-removed@synthetic.invalid", "Synthetic-app-removed-123!"],
  deleting: ["app-e2e-delete@synthetic.invalid", "Synthetic-app-delete-123!"],
  adminDelete: ["app-e2e-admin-delete@synthetic.invalid", "Synthetic-app-admin-delete-123!"],
  superadmin: ["app-e2e-super@synthetic.invalid", "Synthetic-app-super-123!"],
};

async function service(path, method = "GET", body) {
  const result = await requestJson(`${apiUrl}/rest/v1/${path}`, { key: serviceRoleKey, method, body, headers: { Prefer: "resolution=merge-duplicates" } });
  assert(result.response.ok, `Fixture app E2E no pudo escribir ${path}: ${result.response.status}`);
  return result.data;
}
async function createUser([email, password], name) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }),
  });
  const data = await response.json();
  assert(response.ok && data.id, `No se pudo crear ${email} en Auth aislado.`);
  return data.id;
}
async function seed() {
  const [ownerId, learnerId, removedId, deletingId, adminDeleteId, superId] = await Promise.all([
    createUser([`app-e2e-owner-${randomUUID()}@synthetic.invalid`, "Synthetic-app-owner-123!"], "Owner E2E"),
    createUser(fixture.learner, "Alumno E2E"), createUser(fixture.removed, "Retirado E2E"),
    createUser(fixture.deleting, "Borrado E2E"), createUser(fixture.adminDelete, "Borrado administrativo E2E"),
    createUser(fixture.superadmin, "Super E2E"),
  ]);
  fixture.owner = ownerId;
  await service("organizations", "POST", { id: fixture.org, name: "Escuela App E2E", slug: "app-e2e-a", owner_id: ownerId });
  await service("organization_billing", "POST", { organization_id: fixture.org, platform_subscription_status: "active" });
  await service("organization_admins", "POST", { organization_id: fixture.org, user_id: ownerId, role: "owner" });
  await service("profiles?id=eq." + superId, "PATCH", { is_super_admin: true });
  for (const [id, title, price, status] of [[fixture.free, "Curso E2E gratuito", 0, "published"], [fixture.paid, "Curso E2E de pago", 10, "published"], [fixture.draft, "Curso E2E borrador", 0, "draft"]]) {
    await service("courses", "POST", { id, organization_id: fixture.org, title, description: "Datos synthetic.invalid", price, status });
  }
  await service("organization_students", "POST", { organization_id: fixture.org, user_id: removedId, status: "removed", joined_via: "free" });
  await service("organization_students", "POST", { organization_id: fixture.org, user_id: learnerId, status: "active", joined_via: "free" });
  return { learnerId, deletingId, adminDeleteId };
}

const dotenvNames = new Set();
for (const file of readdirSync(process.cwd()).filter((name) => name.startsWith(".env"))) {
  for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) dotenvNames.add(match[1]);
  }
}
const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|Path|SYSTEMROOT|SystemRoot|WINDIR|ComSpec|PATHEXT|TEMP|TMP|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA|HOME|HOMEDRIVE|HOMEPATH|OS|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS|CI)$/.test(name)));
const env = {
  ...inherited, ...Object.fromEntries([...dotenvNames].map((name) => [name, ""])), NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  STRIPE_SECRET_KEY: "sk_test_isolated_app_fixture", STRIPE_WEBHOOK_SECRET: "", STRIPE_CONNECT_WEBHOOK_SECRET: "", RESEND_API_KEY: "", RESEND_FROM_EMAIL: "",
  MUX_TOKEN_ID: "", MUX_TOKEN_SECRET: "", MUX_WEBHOOK_SECRET: "", MUX_SIGNING_KEY: "", MUX_PRIVATE_KEY: "", MUX_DELETION_MODE: "off", EMAIL_DELIVERY_MODE: "off",
  IMPERSONATION_SESSION_KEY: Buffer.alloc(32, 19).toString("base64"),
};
await seed();
const run = (args) => new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { stdio: "inherit", env });
  child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`next ${args.join(" ")} termino con ${code}`)));
});
await run(["build"]);
const runtimeEnv = { ...env, NODE_OPTIONS: `--require=${resolve(process.cwd(), "scripts/audit-network-guard.cjs")}` };
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "localhost"], { stdio: "inherit", env: runtimeEnv });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
next.once("exit", (code) => { process.exitCode = code ?? 1; });
