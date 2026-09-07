import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleOpenCheckouts } from "@/lib/stripe/settleOpenCheckouts";
import { runAccountDeletionJobs } from "./runner";

export async function processAccountDeletionJobs(limit = 5, jobId?: string) {
  return runAccountDeletionJobs(createAdminClient(), settleOpenCheckouts, limit, jobId);
}
