"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(await orgPath("/login"));
}
