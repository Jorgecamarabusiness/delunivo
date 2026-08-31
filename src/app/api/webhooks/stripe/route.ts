import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import {
  handlePlatformSubscriptionCheckout,
  updatePlatformBillingStatusByCustomer,
} from "@/lib/stripe/handlePlatformBilling";

// Eventos de la cuenta PRINCIPAL de Delunivo: solo la suscripción mensual de
// plataforma. Las ventas de cursos deben llegar siempre desde Stripe Connect.
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
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const configuredForLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (event.livemode !== configuredForLiveMode) {
    return NextResponse.json({ received: true, ignored: "stripe_mode_mismatch" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await handlePlatformSubscriptionCheckout(session);
      } else {
        throw new Error(
          "Una venta de curso ha llegado a la cuenta principal; se rechaza por seguridad."
        );
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      await updatePlatformBillingStatusByCustomer(invoice.customer, "active");
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      await updatePlatformBillingStatusByCustomer(invoice.customer, "past_due");
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await updatePlatformBillingStatusByCustomer(subscription.customer, "canceled");
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
