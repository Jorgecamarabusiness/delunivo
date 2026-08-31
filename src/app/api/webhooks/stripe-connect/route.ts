import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleCheckoutSessionCompleted } from "@/lib/stripe/handleCheckoutCompleted";

// Endpoint separado con su propio signing secret: eventos de cuentas
// CONECTADAS (Stripe Connect), no de la cuenta principal de la plataforma.
// Hay que registrarlo a mano en el dashboard de Stripe (Connect > Webhooks),
// apuntando a esta URL — ver docs/database.md, sección Integraciones externas.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Falta la firma de Stripe." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const configuredForLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (event.livemode !== configuredForLiveMode) {
    return NextResponse.json({ received: true, ignored: "stripe_mode_mismatch" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      if (!event.account) {
        throw new Error("El evento Connect no identifica la cuenta conectada.");
      }
      await handleCheckoutSessionCompleted(session, event.account);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Error desconocido." },
        { status: 500 }
      );
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    if (!event.account || event.account !== account.id) {
      return NextResponse.json(
        { error: "La cuenta del evento Connect no coincide." },
        { status: 400 }
      );
    }

    const status =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted
      ? "connected"
      : "pending";

    const admin = createAdminClient();
    const { error } = await admin
      .from("organization_integrations")
      .update({ stripe_connect_status: status })
      .eq("stripe_account_id", account.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
