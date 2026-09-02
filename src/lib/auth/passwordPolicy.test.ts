import test from "node:test";
import assert from "node:assert/strict";
import { passwordPolicyError } from "./passwordPolicy.ts";

test("exige longitud, una letra y un número", () => {
  assert.match(passwordPolicyError("Aa123")!, /10 caracteres/);
  assert.match(passwordPolicyError("abcdefghij")!, /letra y un número/);
  assert.match(passwordPolicyError("1234567890")!, /letra y un número/);
  assert.equal(passwordPolicyError("segura-2026"), null);
});
