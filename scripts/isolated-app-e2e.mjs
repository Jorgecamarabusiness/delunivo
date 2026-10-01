/** Starts a real local Next process against the Supabase stack already started by CI. */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, generateKeyPairSync } from "node:crypto";
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
  await service("courses", "POST", { id: "70000000-0000-4000-8000-000000000004", organization_id: fixture.org, title: "Compra histórica sintética", description: "Fixture de justificante", price: 10, status: "published" });
  await service("purchases", "POST", { id: "70000000-0000-4000-8000-000000000005", organization_id: fixture.org, user_id: learnerId, course_id: "70000000-0000-4000-8000-000000000004", amount_paid: 10, payment_method: "stripe", external_reference: "cs_synthetic_historical_receipt" });
  // A separate new-offer school exercises the actual consumer and database.
  // No real Stripe/Mux API or customer is involved in these fixtures.
  const capacityOrg="71000000-0000-4000-8000-000000000001",capacityCourse="71000000-0000-4000-8000-000000000002",capacityLesson="71000000-0000-4000-8000-000000000003",capacityAsset="71000000-0000-4000-8000-000000000004",block="71000000-0000-4000-8000-000000000005";
  const capacityOwner=await createUser(["capacity-app-owner@synthetic.invalid","Synthetic-capacity-owner-123!"],"Owner capacidad");
  await service("organizations","POST",{id:capacityOrg,name:"Capacidad aislada",slug:"capacity-app",owner_id:capacityOwner});
  await service("organization_admins","POST",{organization_id:capacityOrg,user_id:capacityOwner,role:"owner"});
  await service("organization_billing","POST",{organization_id:capacityOrg,platform_subscription_status:"active",access_mode:"standard",offer_version:"2026-10-01",plan_key:"inicio",quota_mode:"enforce",accepted_offer:{version:"2026-10-01",name:"Inicio"},library_limit_seconds:72000,economic_limit_seconds:86400});
  await service("platform_capacity_cycles","POST",{organization_id:capacityOrg,starts_at:new Date(Date.now()-86400000).toISOString(),rights_start_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+29*86400000).toISOString(),plan_key:"inicio",offer_snapshot:{version:"2026-10-01"},base_seconds:180000,grace_seconds:18000});
  const storagePath=`${capacityOrg}/capacity-export.txt`;
  const uploaded=await fetch(`${apiUrl}/storage/v1/object/public-media/${storagePath}`,{method:"POST",headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,"content-type":"text/plain"},body:"Only synthetic creator content."});
  assert(uploaded.ok,"Capacity export Storage fixture failed");
  await service("courses","POST",{id:capacityCourse,organization_id:capacityOrg,title:"Curso capacidad",description:"Synthetic",price:0,status:"published",thumbnail_url:`${apiUrl}/storage/v1/object/public/public-media/${storagePath}`});
  await service("lessons","POST",{id:capacityLesson,course_id:capacityCourse,title:"Vídeo largo sintético",status:"published",order_index:0,blocks:[{id:block,type:"video_file",mux_video_asset_id:capacityAsset}]});
  await service("video_assets","POST",{id:capacityAsset,organization_id:capacityOrg,course_id:capacityCourse,lesson_id:capacityLesson,block_id:block,created_by:capacityOwner,mux_asset_id:"capacity-synthetic",mux_playback_id:"capacity-synthetic-playback",mux_environment:"capacity-synthetic",status:"ready",is_current:true,duration_seconds:43200});
  await service("organization_students","POST",{organization_id:capacityOrg,user_id:learnerId,status:"active",joined_via:"free"});
  await service("student_course_access","POST",{user_id:learnerId,course_id:capacityCourse});
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
const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
const env = {
  ...inherited, ...Object.fromEntries([...dotenvNames].map((name) => [name, ""])), NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  STRIPE_SECRET_KEY: "sk_test_isolated_app_fixture", STRIPE_WEBHOOK_SECRET: "", STRIPE_CONNECT_WEBHOOK_SECRET: "", RESEND_API_KEY: "", RESEND_FROM_EMAIL: "",
  MUX_TOKEN_ID: "", MUX_TOKEN_SECRET: "", MUX_WEBHOOK_SECRET: "", MUX_SIGNING_KEY: "isolated-synthetic-signing", MUX_PRIVATE_KEY: Buffer.from(privateKey).toString("base64"), MUX_DELETION_MODE: "off", EMAIL_DELIVERY_MODE: "off",
  PLATFORM_PLANS_ENABLED:"true",
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
