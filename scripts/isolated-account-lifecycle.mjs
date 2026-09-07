import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const { apiUrl, anonKey, serviceRoleKey } = localSupabase();
const suffix = `${Date.now()}-${process.pid}`;
const password = "Synthetic-pass-123!";
const hash = "d".repeat(64);

async function signUp(label, email = `${label}-${suffix}@synthetic.invalid`) {
  const result = await requestJson(`${apiUrl}/auth/v1/signup`, { key: anonKey, method: "POST", body: { email, password } });
  assert(result.response.ok && result.data?.user?.id && result.data?.access_token, `No se pudo crear ${label}.`);
  return result.data;
}
async function rpc(name, body, token = serviceRoleKey, key = serviceRoleKey) {
  const result = await requestJson(`${apiUrl}/rest/v1/rpc/${name}`, { key, token, method: "POST", body });
  assert(result.response.ok, `${name} devolvio HTTP ${result.response.status}.`);
  return result.data;
}
async function servicePatch(table, query, body) {
  return requestJson(`${apiUrl}/rest/v1/${table}?${query}`, { key: serviceRoleKey, method: "PATCH", body, headers: { Prefer: "return=representation" } });
}
async function serviceGet(table, query) {
  const result = await requestJson(`${apiUrl}/rest/v1/${table}?${query}`, { key: serviceRoleKey });
  assert(result.response.ok && Array.isArray(result.data), `No se pudo leer ${table}.`);
  return result.data;
}
async function deleteAuthUser(id) {
  return fetch(`${apiUrl}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` } });
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
const lateBuyer = await signUp("lifecycle-late-buyer");
const ownerA = await signUp("lifecycle-owner-a");
const ownerB = await signUp("lifecycle-owner-b");
const superA = await signUp("lifecycle-super-a");
const superB = await signUp("lifecycle-super-b");
const orgA = "10000000-0000-4000-8000-000000000001";
const orgB = "10000000-0000-4000-8000-000000000002";
const orgOwners = "10000000-0000-4000-8000-000000000003";
const freeA = "20000000-0000-4000-8000-000000000001";
const paidA = "20000000-0000-4000-8000-000000000002";
const draftA = "20000000-0000-4000-8000-000000000003";
const freeB = "20000000-0000-4000-8000-000000000004";
for (const body of [
  { id: orgA, name: "Lifecycle A", slug: `lifecycle-a-${suffix}`, owner_id: owner.user.id },
  { id: orgB, name: "Lifecycle B", slug: `lifecycle-b-${suffix}`, owner_id: owner.user.id },
  { id: orgOwners, name: "Lifecycle owners", slug: `lifecycle-owners-${suffix}`, owner_id: ownerA.user.id },
]) {
  const r = await requestJson(`${apiUrl}/rest/v1/organizations`, { key: serviceRoleKey, method: "POST", body, headers: { Prefer: "resolution=merge-duplicates" } }); assert(r.response.ok, "No se pudo preparar la organizacion sintetica.");
}
for (const organization_id of [orgA, orgB, orgOwners]) { const r = await requestJson(`${apiUrl}/rest/v1/organization_billing`, { key: serviceRoleKey, method: "POST", body: { organization_id, platform_subscription_status: "active" }, headers: { Prefer: "resolution=merge-duplicates" } }); assert(r.response.ok, "No se pudo preparar billing sintetico."); }
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
for (const id of [superA.user.id, superB.user.id]) {
  const result = await servicePatch("profiles", `id=eq.${id}`, { is_super_admin: true });
  assert(result.response.ok, "No se pudo preparar superadmin sintetico.");
}
const superRemoval = await Promise.all([superA, superB].map(({ user }) => servicePatch("profiles", `id=eq.${user.id}`, { is_super_admin: false })));
assert(superRemoval.filter((result) => result.response.ok).length === 1, "La baja concurrente del ultimo superadmin debe dejar exactamente un sucesor.");
assert((await serviceGet("profiles", "is_super_admin=eq.true&select=id")).length === 1, "Debe quedar un superadmin activo tras la carrera sintetica.");

for (const body of [
  { organization_id: orgOwners, user_id: ownerA.user.id, role: "owner" },
  { organization_id: orgOwners, user_id: ownerB.user.id, role: "owner" },
]) {
  const result = await requestJson(`${apiUrl}/rest/v1/organization_admins`, { key: serviceRoleKey, method: "POST", body });
  assert(result.response.ok, "No se pudo preparar sucesion de owner sintetica.");
}
assert(!(await deleteAuthUser(ownerA.user.id)).ok, "Auth no puede borrar al owner canonico sin sucesor.");
const canonicalTransfer = await servicePatch("organizations", `id=eq.${orgOwners}`, { owner_id: ownerB.user.id });
assert(canonicalTransfer.response.ok, "No se pudo transferir el owner sintetico.");
const membershipTransfer = await requestJson(`${apiUrl}/rest/v1/organization_admins?organization_id=eq.${orgOwners}&user_id=eq.${ownerA.user.id}`, { key: serviceRoleKey, method: "DELETE" });
assert(membershipTransfer.response.ok, "No se pudo retirar al owner sustituido.");
assert((await deleteAuthUser(ownerA.user.id)).ok, "Auth debe borrar al owner despues de transferirlo a un sucesor activo.");
for (const token of [undefined, learner.access_token]) { const r = await requestJson(`${apiUrl}/rest/v1/rpc/begin_account_deletion`, { key: token ? anonKey : anonKey, token: token ?? anonKey, method: "POST", body: {} }); assert(!r.response.ok, "Las RPC privadas no deben estar expuestas."); }
const lateAttempt = "40000000-0000-4000-8000-000000000001";
const lateSession = `cs_late_${suffix}`;
const lateIntent = `pi_late_${suffix}`;
const connected = await requestJson(`${apiUrl}/rest/v1/organization_integrations`, { key: serviceRoleKey, method: "POST", body: { organization_id: orgA, stripe_account_id: "acct_synthetic_late", stripe_connect_status: "connected" } });
assert(connected.response.ok, "No se pudo preparar Connect simulado para la regresion de pago.");
const lateAttemptInsert = await requestJson(`${apiUrl}/rest/v1/stripe_checkout_attempts`, { key: serviceRoleKey, method: "POST", body: {
  id: lateAttempt, checkout_kind: "course_purchase", organization_id: orgA, user_id: lateBuyer.user.id, course_id: paidA,
  stripe_account_id: "acct_synthetic_late", stripe_session_id: lateSession, stripe_session_url: "https://synthetic.invalid/checkout",
  stripe_params: {}, expected_amount_total: 100, expected_currency: "eur", status: "open",
} });
assert(lateAttemptInsert.response.ok, "No se pudo crear checkout sintetico.");
const lateJobId = await rpc("begin_account_deletion", { p_actor_id: lateBuyer.user.id, p_target_id: lateBuyer.user.id, p_actor_session_id: sessionId(lateBuyer.access_token), p_confirmation_email: lateBuyer.user.email, p_reason: null, p_successors: {}, p_super_successor: null, p_tracking_hash: hash });
await rpc("complete_course_checkout", { p_attempt_id: lateAttempt, p_session_id: lateSession, p_account_id: "acct_synthetic_late", p_amount_cents: 100, p_currency: "eur", p_payment_intent_id: lateIntent });
const [latePurchase] = await serviceGet("purchases", `external_reference=eq.${lateSession}&select=user_id,historical_user_id,reconciliation_required`);
assert(latePurchase?.user_id === null && latePurchase.historical_user_id === lateBuyer.user.id && latePurchase.reconciliation_required === true, "El pago tardio de una cuenta deleting debe conservar historia y exigir conciliacion.");
const eventNew = new Date().toISOString(); const eventOld = new Date(Date.now() - 60_000).toISOString();
await rpc("apply_course_payment_adjustment", { p_account: "acct_synthetic_late", p_payment_intent: lateIntent, p_refunded_cents: 0, p_dispute_status: "lost", p_event_at: eventNew });
await rpc("apply_course_payment_adjustment", { p_account: "acct_synthetic_late", p_payment_intent: lateIntent, p_refunded_cents: 0, p_dispute_status: "won", p_event_at: eventOld });
await rpc("apply_course_payment_adjustment", { p_account: "acct_synthetic_late", p_payment_intent: lateIntent, p_refunded_cents: 100, p_dispute_status: null, p_event_at: eventNew });
await rpc("apply_course_payment_adjustment", { p_account: "acct_synthetic_late", p_payment_intent: lateIntent, p_refunded_cents: 1, p_dispute_status: null, p_event_at: eventOld });
const [adjustedPurchase] = await serviceGet("purchases", `external_reference=eq.${lateSession}&select=access_status,refunded_amount_cents,dispute_status`);
assert(adjustedPurchase.refunded_amount_cents === 100 && adjustedPurchase.dispute_status === "lost" && adjustedPurchase.access_status === "refunded", "Refunds y disputas fuera de orden deben conservar el maximo y el ultimo evento valido.");
const initialClaim = await rpc("claim_account_deletion_job", { p_job_id: lateJobId });
assert(Array.isArray(initialClaim) && initialClaim.length === 1, "El job deleting debe poder reclamarse.");
const retry = await servicePatch("account_deletion_jobs", `id=eq.${lateJobId}`, { status: "retry", lease_until: "2000-01-01T00:00:00.000Z", next_attempt_at: "2000-01-01T00:00:00.000Z" });
assert(retry.response.ok, "No se pudo preparar el reintento sintetico.");
const retryClaims = await Promise.all(Array.from({ length: 2 }, () => rpc("claim_account_deletion_job", { p_job_id: lateJobId })));
assert(retryClaims.filter((rows) => Array.isArray(rows) && rows.length === 1).length === 1, "Un lease vencido debe ser reclamado por un solo worker.");
const retryClaim = retryClaims.find((rows) => Array.isArray(rows) && rows.length === 1)[0];
assert((await servicePatch("account_deletion_jobs", `id=eq.${lateJobId}`, { stage: "personal_data" })).response.ok, "No se pudo avanzar el job sintetico a limpieza.");
await rpc("clean_account_personal_data", { p_job_id: lateJobId, p_lease_token: retryClaim.lease_token });
assert((await deleteAuthUser(lateBuyer.user.id)).ok, "Auth delete aislado del comprador tardio fallo.");
const jobId = await rpc("begin_account_deletion", { p_actor_id: learner.user.id, p_target_id: learner.user.id, p_actor_session_id: sessionId(learner.access_token), p_confirmation_email: learner.user.email, p_reason: null, p_successors: {}, p_super_successor: null, p_tracking_hash: hash });
const oldRows = await requestJson(`${apiUrl}/rest/v1/student_course_access?user_id=eq.${learner.user.id}`, { key: anonKey, token: learner.access_token }); assert(oldRows.response.ok && Array.isArray(oldRows.data) && oldRows.data.length === 0, "El JWT previo no debe leer grants tras iniciar borrado.");
assert(await rpc("grant_free_course_access", { p_course_id: freeA, p_organization_id: orgA }, learner.access_token, anonKey) === "account_inactive", "El JWT previo no debe emitir nuevos grants.");
const claimed = await rpc("claim_account_deletion_job", { p_job_id: jobId }); assert(Array.isArray(claimed) && claimed.length === 1 && claimed[0].lease_token, "El job debe reclamarse con lease.");
await requestJson(`${apiUrl}/rest/v1/account_deletion_jobs?id=eq.${jobId}`, { key: serviceRoleKey, method: "PATCH", body: { stage: "personal_data" } });
await rpc("clean_account_personal_data", { p_job_id: jobId, p_lease_token: claimed[0].lease_token });
const deleted = await deleteAuthUser(learner.user.id); assert(deleted.ok, "Auth delete aislado fallo.");
const refresh = await requestJson(`${apiUrl}/auth/v1/token?grant_type=refresh_token`, { key: anonKey, method: "POST", body: { refresh_token: learner.refresh_token } }); assert(!refresh.response.ok, "El refresh borrado no debe renovarse.");
const recreatedLearner = await signUp("lifecycle-recreated", learner.user.email);
assert(recreatedLearner.user.id !== learner.user.id, "Un alta con el mismo email debe ser una identidad nueva.");
const recreatedRows = await requestJson(`${apiUrl}/rest/v1/student_course_access?user_id=eq.${recreatedLearner.user.id}`, { key: anonKey, token: recreatedLearner.access_token });
assert(recreatedRows.response.ok && Array.isArray(recreatedRows.data) && recreatedRows.data.length === 0, "El nuevo UUID del mismo email no puede heredar derechos historicos.");
console.log("Lifecycle/free access: concurrency, succession, late payments, lease retry, revocation and synthetic Auth deletion verified.");
