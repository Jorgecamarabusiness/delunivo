import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import * as nodeModule from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, test } from "node:test";

// Isolate the actual server helper/guards from Next and real Supabase. Node's
// test runner runs this file in its own process; no application environment is used.
const fixtureKey = "__delunivoRunAsRestorationTest";
const registry = globalThis as unknown as Record<string, unknown>;
type ResolveResult = { url: string; shortCircuit?: boolean };
type NextResolve = (specifier: string, context: { parentURL?: string }) => ResolveResult;
type ResolveHook = (specifier: string, context: { parentURL?: string }, nextResolve: NextResolve) => ResolveResult;
// Runtime is Node 24; the repository intentionally retains @types/node 20.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => { deregister: () => void } };
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const stub = (source: string) => ({url:`data:text/javascript,${encodeURIComponent(source)}`,shortCircuit:true});
  const state = `globalThis.${fixtureKey}`;
  if (specifier === "server-only") return stub("export {};");
  if (specifier === "next/headers") return stub(`export const cookies = async () => ${state}.cookieStore;`);
  if (specifier === "@/lib/supabase/server") return stub(`export const createClient = async () => ${state}.supabase;`);
  if (specifier === "@/lib/supabase/admin") return stub(`export const createAdminClient = () => ${state}.admin;`);
  if (specifier.startsWith("@/") || (specifier.startsWith(".") && context.parentURL?.includes("/src/lib/auth/"))) {
    const url = specifier.startsWith("@/") ? new URL(`../../${specifier.slice(2)}.ts`,import.meta.url) : new URL(`${specifier}.ts`,context.parentURL);
    if (existsSync(fileURLToPath(url))) return {url:pathToFileURL(fileURLToPath(url)).href,shortCircuit:true};
  }
  return nextResolve(specifier,context);
}});
const previousKey = process.env.IMPERSONATION_SESSION_KEY;
process.env.IMPERSONATION_SESSION_KEY = Buffer.alloc(32,9).toString("base64");
after(() => {
  hooks.deregister(); delete registry[fixtureKey];
  if (previousKey === undefined) delete process.env.IMPERSONATION_SESSION_KEY;
  else process.env.IMPERSONATION_SESSION_KEY = previousKey;
});

const { restoreActorSession } = await import("./restoreImpersonation.ts");
const { rejectSensitiveActionDuringImpersonation } = await import("./impersonation.ts");

function fixture(fail: "revoke" | "audit" | null) {
  const effects: string[] = [];
  const marker = "synthetic-manual-support-marker";
  const cipher = createCipheriv("aes-256-gcm",Buffer.alloc(32,9),Buffer.alloc(12,2));
  cipher.setAAD(Buffer.from("delunivo-support-impersonation:v1"));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({accessToken:"synthetic-actor",refreshToken:"synthetic-actor-refresh"})),cipher.final()]);
  const audit = {id:"synthetic-audit",actor_user_id:"actor",target_user_id:"target",token_hash:createHash("sha256").update(marker).digest("hex"),encrypted_actor_session:`v1.${Buffer.alloc(12,2).toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`,status:"active",expires_at:new Date(Date.now()+600_000).toISOString()};
  const cookieValues = new Map([["delunivo_run_as",marker]]);
  let identity = "target";
  const supabase = {auth:{
    getUser:async()=>({data:{user:{id:identity}}}),
    getSession:async()=>({data:{session:{access_token:`synthetic-${identity}`}}}),
    setSession:async()=>{effects.push("restore");identity="actor";return {error:null};},
  }};
  const query = {select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{...audit}}),in:async()=>({data:[{id:"actor",name:"Actor"},{id:"target",name:"Target"}]})};
  const admin = {
    from:()=>query,
    rpc:async()=>{effects.push("audit");if(fail==="audit") return {error:{message:"Synthetic audit failure"}};audit.status="ended";return {error:null};},
    auth:{admin:{signOut:async()=>{effects.push("revoke");return {error:fail==="revoke" ? {status:503} : null};}}},
  };
  registry[fixtureKey] = {supabase,admin,cookieStore:{get:(name:string)=>cookieValues.has(name) ? {value:cookieValues.get(name)} : undefined,delete:(name:string)=>cookieValues.delete(name)}};
  return {effects,audit,cookieValues,identity:()=>identity};
}

test("manual Run as keeps sensitive actions blocked when revocation fails", async () => {
  const state = fixture("revoke");
  await assert.rejects(restoreActorSession({requestedStatus:"ended"}),/sesión temporal/);
  assert.deepEqual(state.effects,["revoke"]);
  assert.equal(state.audit.status,"active");
  assert.equal(state.identity(),"target");
  assert.match((await rejectSensitiveActionDuringImpersonation("target"))!,/bloqueada/);
});

test("an audit failure after target revocation never switches to the actor", async () => {
  const state = fixture("audit");
  await assert.rejects(restoreActorSession({requestedStatus:"ended"}),/Synthetic audit failure/);
  assert.deepEqual(state.effects,["revoke","audit"]);
  assert.equal(state.identity(),"target");
});

test("manual Run as revokes and audits before restoring the actor", async () => {
  const state = fixture(null);
  assert.equal(await restoreActorSession({requestedStatus:"ended"}),true);
  assert.deepEqual(state.effects,["revoke","audit","restore"]);
  assert.equal(state.identity(),"actor");
  assert.equal(state.audit.status,"ended");
  assert.equal(state.cookieValues.has("delunivo_run_as"),false);
});
