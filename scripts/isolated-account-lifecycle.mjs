import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const { apiUrl, anonKey, serviceRoleKey } = localSupabase();
const suffix = `${Date.now()}-${process.pid}`;
const password = "Synthetic-pass-123!";
const hash = "d".repeat(64);

async function signUp(label) {
  const result = await requestJson(`${apiUrl}/auth/v1/signup`, { key: anonKey, method: "POST", body: { email: `${label}-${suffix}@synthetic.invalid`, password } });
  assert(result.response.ok && result.data?.user?.id && result.data?.access_token, `No se pudo crear ${label}.`);
  return result.data;
}
async function rpc(name, body, token = serviceRoleKey, key = serviceRoleKey) {
  const result = await requestJson(`${apiUrl}/rest/v1/rpc/${name}`, { key, token, method: "POST", body });
  assert(result.response.ok, `${name} devolvio HTTP ${result.response.status}.`);
  return result.data;
}
function sessionId(token) {
  const payload = JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf8"));
  assert(payload.session_id, "El JWT local no contiene session_id.");
  return payload.session_id;
}

const owner = await signUp("lifecycle-owner");
const learner = await signUp("lifecycle-learner");
const removed = await signUp("lifecycle-removed");
const revoked = await signUp("lifecycle-revoked");
const orgA = "10000000-0000-4000-8000-000000000001";
const orgB = "10000000-0000-4000-8000-000000000002";
const freeA = "20000000-0000-4000-8000-000000000001";
const paidA = "20000000-0000-4000-8000-000000000002";
const draftA = "20000000-0000-4000-8000-000000000003";
const freeB = "20000000-0000-4000-8000-000000000004";
for (const body of [
  { id: orgA, name: "Lifecycle A", slug: `lifecycle-a-${suffix}`, owner_id: owner.user.id },
  { id: orgB, name: "Lifecycle B", slug: `lifecycle-b-${suffix}`, owner_id: owner.user.id },
]) {
  const r = await requestJson(`${apiUrl}/rest/v1/organizations`, { key: serviceRoleKey, method: "POST", body, headers: { Prefer: "resolution=merge-duplicates" } }); assert(r.response.ok, "No se pudo preparar la organizacion sintetica.");
}
for (const organization_id of [orgA, orgB]) { const r = await requestJson(`${apiUrl}/rest/v1/organization_billing`, { key: serviceRoleKey, method: "POST", body: { organization_id, platform_subscription_status: "active" }, headers: { Prefer: "resolution=merge-duplicates" } }); assert(r.response.ok, "No se pudo preparar billing sintetico."); }
for (const body of [
  { id: freeA, organization_id: orgA, title: "Free", description: "Synthetic", price: 0, status: "published" },
  { id: paidA, organization_id: orgA, title: "Paid", description: "Synthetic", price: 1, status: "published" },
  { id: draftA, organization_id: orgA, title: "Draft", description: "Synthetic", price: 0, status: "draft" },
  { id: freeB, organization_id: orgB, title: "Free B", description: "Synthetic", price: 0, status: "published" },
]) { const r = await requestJson(`${apiUrl}/rest/v1/courses`, { key: serviceRoleKey, method: "POST", body }); assert(r.response.ok, "No se pudo preparar curso sintetico."); }

const calls = await Promise.all(Array.from({ length: 10 }, () => rpc("grant_free_course_access", { p_course_id: freeA, p_organization_id: orgA }, learner.access_token, anonKey)));
assert(calls.filter((x) => x === "granted").length === 1, "El acceso gratis concurrente debe concederse una sola vez.");
assert(calls.filter((x) => x === "already_has_access").length === 9, "Los duplicados gratis deben ser idempotentes.");
for (const [course, org, expected] of [[paidA, orgA, "price_changed"], [draftA, orgA, "not_available"], [freeB, orgA, "not_available"], [freeB, orgB, "granted"]]) assert(await rpc("grant_free_course_access", { p_course_id: course, p_organization_id: org }, learner.access_token, anonKey) === expected, `Resultado gratis esperado: ${expected}.`);
for (const [user, status, course] of [[removed, "removed", paidA], [revoked, "revoked", freeA]]) {
  await requestJson(`${apiUrl}/rest/v1/organization_students`, { key: serviceRoleKey, method: "POST", body: { organization_id: orgA, user_id: user.user.id, status: status === "removed" ? "removed" : "active", joined_via: "free" } });
  if (status === "revoked") await requestJson(`${apiUrl}/rest/v1/student_course_access`, { key: serviceRoleKey, method: "POST", body: { user_id: user.user.id, course_id: course, grant_source: "free", revoked_at: new Date().toISOString() } });
  assert(await rpc("grant_free_course_access", { p_course_id: course, p_organization_id: orgA }, user.access_token, anonKey) === status, `Debe respetar acceso ${status}.`);
}
for (const token of [undefined, learner.access_token]) { const r = await requestJson(`${apiUrl}/rest/v1/rpc/begin_account_deletion`, { key: token ? anonKey : anonKey, token: token ?? anonKey, method: "POST", body: {} }); assert(!r.response.ok, "Las RPC privadas no deben estar expuestas."); }
const jobId = await rpc("begin_account_deletion", { p_actor_id: learner.user.id, p_target_id: learner.user.id, p_actor_session_id: sessionId(learner.access_token), p_confirmation_email: learner.user.email, p_reason: null, p_successors: {}, p_super_successor: null, p_tracking_hash: hash });
const oldRows = await requestJson(`${apiUrl}/rest/v1/student_course_access?user_id=eq.${learner.user.id}`, { key: anonKey, token: learner.access_token }); assert(oldRows.response.ok && Array.isArray(oldRows.data) && oldRows.data.length === 0, "El JWT previo no debe leer grants tras iniciar borrado.");
assert(await rpc("grant_free_course_access", { p_course_id: freeA, p_organization_id: orgA }, learner.access_token, anonKey) === "account_inactive", "El JWT previo no debe emitir nuevos grants.");
const claimed = await rpc("claim_account_deletion_job", { p_job_id: jobId }); assert(Array.isArray(claimed) && claimed.length === 1 && claimed[0].lease_token, "El job debe reclamarse con lease.");
await requestJson(`${apiUrl}/rest/v1/account_deletion_jobs?id=eq.${jobId}`, { key: serviceRoleKey, method: "PATCH", body: { stage: "personal_data" } });
await rpc("clean_account_personal_data", { p_job_id: jobId, p_lease_token: claimed[0].lease_token });
const deleted = await fetch(`${apiUrl}/auth/v1/admin/users/${learner.user.id}`, { method: "DELETE", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` } }); assert(deleted.ok, "Auth delete aislado fallo.");
const refresh = await requestJson(`${apiUrl}/auth/v1/token?grant_type=refresh_token`, { key: anonKey, method: "POST", body: { refresh_token: learner.refresh_token } }); assert(!refresh.response.ok, "El refresh borrado no debe renovarse.");
console.log("Lifecycle/free access: grants, scopes, revocation, lease, cleanup and isolated Auth deletion verified.");
