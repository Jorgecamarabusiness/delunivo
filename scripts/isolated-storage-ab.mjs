import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const { apiUrl, anonKey, serviceRoleKey } = localSupabase();
const suffix = `${Date.now()}-${process.pid}`;
const password = "Synthetic-pass-123!";

async function signUp(label) {
  const { response, data } = await requestJson(`${apiUrl}/auth/v1/signup`, {
    key: anonKey,
    method: "POST",
    body: { email: `storage-${label}-${suffix}@synthetic.invalid`, password },
  });
  assert(response.ok && data?.access_token && data?.user?.id, `No se pudo crear el usuario sintetico ${label}.`);
  return data;
}

const normal = await signUp("normal");
const superAdmin = await signUp("superadmin");
const elevation = await requestJson(`${apiUrl}/rest/v1/profiles?id=eq.${superAdmin.user.id}`, {
  key: serviceRoleKey,
  token: serviceRoleKey,
  method: "PATCH",
  body: { is_super_admin: true },
  headers: { Prefer: "return=minimal" },
});
assert(elevation.response.ok, "No se pudo preparar el superadmin sintetico.");

async function upload(token, name) {
  return fetch(`${apiUrl}/storage/v1/object/lesson-media/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "text/plain",
      "x-upsert": "false",
    },
    body: "synthetic storage fixture",
  });
}

const normalName = `ci/${suffix}/normal.txt`;
const superName = `ci/${suffix}/superadmin.txt`;
const normalUpload = await upload(normal.access_token, normalName);
assert(!normalUpload.ok, "Un usuario normal no debe poder escribir en lesson-media.");
const superUpload = await upload(superAdmin.access_token, superName);
assert(superUpload.ok, `Un superadmin sintetico debe poder escribir en lesson-media (HTTP ${superUpload.status}).`);

const cleanup = await fetch(`${apiUrl}/storage/v1/object/lesson-media`, {
  method: "DELETE",
  headers: {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ prefixes: [superName] }),
});
assert(cleanup.ok, `No se pudo retirar el objeto Storage sintetico (HTTP ${cleanup.status}).`);
console.log("Storage A/B: usuario normal denegado y superadmin sintetico autorizado.");
