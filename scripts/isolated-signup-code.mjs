import { createHash } from "node:crypto";
import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

// The browser registers through the real application. Only delivery is replaced:
// a known synthetic code is seeded without sending mail or weakening Auth/RPC.
const email = process.argv[2];
assert(email === "app-e2e-register@synthetic.invalid", "Only the isolated signup fixture is permitted.");
const { apiUrl, serviceRoleKey } = localSupabase();
const result = await requestJson(`${apiUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(email)}&purpose=eq.signup&consumed_at=is.null`, {
  key: serviceRoleKey, method: "PATCH", headers: { Prefer: "return=representation" },
  body: { code_hash: createHash("sha256").update("729184").digest("hex") },
});
assert(result.response.ok && result.data.length === 1, "Expected one freshly issued local signup code.");
