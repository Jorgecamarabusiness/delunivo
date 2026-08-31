import { NextResponse, type NextRequest } from "next/server";
import {
  REFERRAL_CODE_PATTERN,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/referrals/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const destination = new URL("/crear-empresa", request.url);

  if (!REFERRAL_CODE_PATTERN.test(code)) {
    destination.searchParams.set("referido", "invalido");
    return NextResponse.redirect(destination);
  }

  const { data } = await createAdminClient()
    .from("organization_referral_codes")
    .select("id")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    destination.searchParams.set("referido", "invalido");
    return NextResponse.redirect(destination);
  }

  destination.searchParams.set("referido", "1");
  const response = NextResponse.redirect(destination);
  // El código no concede nada por sí solo: el alta vuelve a validarlo en
  // servidor y las restricciones únicas impiden apilar o cambiar afiliación.
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
