import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { getWhopMembershipByLicenseKey, isWhopMembershipValid } from "@/lib/whop/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLicenseKeyEmail } from "@/lib/resend/sendLicenseKeyEmail";
import { MAIN_COURSE_ID } from "@/lib/courses/mainCourse";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const rawSecret = Buffer.from(process.env.WHOP_WEBHOOK_SECRET!, "utf8");
  const wh = new Webhook(rawSecret, { format: "raw" });

  let event: { data?: { id?: string }; id?: string };
  try {
    event = wh.verify(body, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    }) as { data?: { id?: string }; id?: string };
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const membershipId = event.data?.id ?? event.id;
  if (!membershipId) {
    return NextResponse.json({ received: true });
  }

  // Este webhook es solo el aviso por email de la license key — la compra
  // real se registra en redeemWhopLicenseAction (por organización, Fase 5).
  // Aquí seguimos con la clave/producto global a propósito: el payload de
  // Whop no trae qué organización es, y para saberlo haría falta ya tener
  // una clave con la que preguntarle a Whop — sin rediseñar el webhook de
  // Whop en sí (un endpoint por organización, o mapear producto->organización
  // antes de llamar a la API) esto se queda de un solo tenant. No bloquea el
  // flujo de compra real, solo este email de cortesía. Ver Fase 9 del plan.
  const membership = await getWhopMembershipByLicenseKey(
    membershipId,
    process.env.WHOP_API_KEY!
  );

  if (
    membership &&
    isWhopMembershipValid(membership, process.env.WHOP_PRODUCT_ID!) &&
    membership.license_key &&
    membership.user?.email
  ) {
    const admin = createAdminClient();
    const { data: course } = await admin
      .from("courses")
      .select("title")
      .eq("id", MAIN_COURSE_ID)
      .single();

    await sendLicenseKeyEmail({
      to: membership.user.email,
      courseTitle: course?.title ?? "tu curso",
      licenseKey: membership.license_key,
    });
  }

  return NextResponse.json({ received: true });
}
