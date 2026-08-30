import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLATFORM_PRICE_CENTS } from "./access";

export async function getPlatformPriceCents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("monthly_price_cents")
    .eq("id", true)
    .maybeSingle();

  return data?.monthly_price_cents ?? DEFAULT_PLATFORM_PRICE_CENTS;
}
