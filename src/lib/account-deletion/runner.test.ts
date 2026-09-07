import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAccountDeletionJobs } from "./runner.ts";

function fixture(stage = "sessions") {
  const events: string[] = [];
  const row = { id: "job", target_user_id: "synthetic", stage, lease_token: "lease", attempts: 1 };
  const state = { lost: false, missingAuth: false, failCheckout: false };
  const updates: Record<string, unknown>[] = [];
  const admin = {
    rpc: async (name: string) => {
      events.push(name);
      if (name === "claim_account_deletion_job") return { data: [{ ...row }], error: null };
      return { data: name === "detach_account_school_storage" ? 0 : null, error: null };
    },
    auth: { admin: {
      updateUserById: async () => { events.push("ban"); return { error: null }; },
      deleteUser: async () => { events.push("delete_auth"); return { error: state.missingAuth ? { code: "user_not_found" } : null }; },
    } },
    from: () => ({ update: (update: Record<string, unknown>) => {
      updates.push(update);
      const query = {
        eq: () => query,
        gt: () => query,
        select: () => query,
        maybeSingle: async () => {
          if (state.lost) return { data: null, error: null };
          if (typeof update.stage === "string") row.stage = update.stage;
          return { data: { id: row.id }, error: null };
        },
      };
      return query;
    } }),
  } as unknown as SupabaseClient;
  const settle = async () => { events.push("settle"); if (state.failCheckout) throw new Error("provider_unavailable"); };
  return { admin, events, row, state, updates, settle };
}

test("deletion runs Auth last and renews each valid stage lease", async () => {
  const f = fixture();
  assert.deepEqual(await runAccountDeletionJobs(f.admin, f.settle, 1), { completed: 1, retried: 0 });
  assert.deepEqual(f.events, ["claim_account_deletion_job", "ban", "settle", "detach_account_school_storage", "clean_account_personal_data", "delete_auth"]);
  for (const update of f.updates.filter(value => value.stage !== "completed")) {
    assert.equal(Date.parse(String(update.lease_until)) - Date.parse(String(update.updated_at)), 300_000);
  }
});

test("provider failure persists a retry at the same stage and resumes before Auth", async () => {
  const f = fixture(); f.state.failCheckout = true;
  assert.deepEqual(await runAccountDeletionJobs(f.admin, f.settle, 1), { completed: 0, retried: 1 });
  assert.equal(f.row.stage, "checkouts");
  assert.equal(f.events.includes("delete_auth"), false);
  assert.equal(f.updates.at(-1)?.last_error_code, "provider_reconciliation_failed");
  f.state.failCheckout = false;
  assert.deepEqual(await runAccountDeletionJobs(f.admin, f.settle, 1), { completed: 1, retried: 0 });
  assert.equal(f.events.filter(value => value === "ban").length, 1);
});

test("an expired or replaced lease cannot reach Auth deletion", async () => {
  const f = fixture("auth"); f.state.lost = true;
  assert.deepEqual(await runAccountDeletionJobs(f.admin, f.settle, 1), { completed: 0, retried: 1 });
  assert.equal(f.events.includes("delete_auth"), false);
  assert.equal(f.updates.at(-1)?.last_error_code, "lease_lost");
});

test("a crash after Auth deletion can finalize an already missing identity", async () => {
  const f = fixture("auth"); f.state.missingAuth = true;
  assert.deepEqual(await runAccountDeletionJobs(f.admin, f.settle, 1), { completed: 1, retried: 0 });
  assert.equal(f.updates.at(-1)?.status, "completed");
});
