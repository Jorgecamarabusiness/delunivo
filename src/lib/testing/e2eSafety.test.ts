import assert from "node:assert/strict";
import { test } from "node:test";
import { assertIsolatedE2EEnvironment } from "../../../scripts/e2e-safety.mjs";

const isolated = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  E2E_DATA_POLICY: "synthetic-only",
  STRIPE_SECRET_KEY: "sk_test_fixture",
};

test("E2E refuses cloud, deceptive hosts and unverified local data before writes", () => {
  for (const url of ["https://jgxqdzmmeveksseflyst.supabase.co", "http://localhost.example.com", "http://localhost@real.example", "file:///tmp/db", "invalid"]) {
    assert.throws(() => assertIsolatedE2EEnvironment({ ...isolated, NEXT_PUBLIC_SUPABASE_URL: url }), /E2E bloqueado/);
  }
  assert.throws(() => assertIsolatedE2EEnvironment({ ...isolated, E2E_DATA_POLICY: "" }), /verifica el contenido/);
  assert.doesNotThrow(() => assertIsolatedE2EEnvironment(isolated));
});

test("E2E refuses live payments and provider credentials even on localhost", () => {
  assert.throws(() => assertIsolatedE2EEnvironment({ ...isolated, STRIPE_SECRET_KEY: "sk_live_fixture" }), /Stripe/);
  for (const key of ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "MUX_SIGNING_KEY", "MUX_PRIVATE_KEY", "MUX_WEBHOOK_SECRET", "RESEND_API_KEY"]) {
    assert.throws(() => assertIsolatedE2EEnvironment({ ...isolated, [key]: "fixture" }), /Mux y Resend/);
  }
});
