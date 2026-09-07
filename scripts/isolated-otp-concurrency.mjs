import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const { apiUrl, serviceRoleKey } = localSupabase();
const issueUrl = `${apiUrl}/rest/v1/rpc/issue_verification_code`;
const consumeUrl = `${apiUrl}/rest/v1/rpc/consume_verification_code`;
const nonce = `${Date.now()}-${process.pid}`;

async function issue(email, hash) {
  const { response, data } = await requestJson(issueUrl, {
    key: serviceRoleKey,
    method: "POST",
    body: { p_email: email, p_code_hash: hash, p_purpose: "signup" },
  });
  assert(response.ok, `La emision OTP local devolvio HTTP ${response.status}.`);
  return data;
}

const issueEmail = `otp-issue-${nonce}@synthetic.invalid`;
const issued = await Promise.all(
  Array.from({ length: 10 }, (_, index) => issue(issueEmail, index.toString(16).padStart(64, "a"))),
);
assert(issued.filter((status) => status === "issued").length === 3, "La emision paralela debe conceder exactamente tres codigos.");
assert(issued.filter((status) => status === "rate_limited_email").length === 7, "La emision paralela debe limitar siete solicitudes por email.");

const consumeEmail = `otp-consume-${nonce}@synthetic.invalid`;
const correctHash = "b".repeat(64);
assert(await issue(consumeEmail, correctHash) === "issued", "No se pudo preparar el codigo OTP sintetico.");
const consumed = await Promise.all(
  Array.from({ length: 10 }, async () => {
    const { response, data } = await requestJson(consumeUrl, {
      key: serviceRoleKey,
      method: "POST",
      body: { p_email: consumeEmail, p_code_hash: "c".repeat(64), p_purpose: "signup" },
    });
    assert(response.ok, `El consumo OTP local devolvio HTTP ${response.status}.`);
    return data?.status;
  }),
);
assert(consumed.filter((status) => status === "incorrect").length === 5, "Cinco intentos incorrectos deben contabilizarse bajo concurrencia.");
assert(consumed.filter((status) => status === "missing").length === 5, "Tras el quinto fallo, el codigo consumido no debe poder reutilizarse.");

console.log("OTP concurrency: 3 emisiones y 5 intentos contabilizados con datos sinteticos.");
