import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { handleCheckoutSessionCompleted } from "@/lib/stripe/handleCheckoutCompleted";
import {
  handlePlatformSubscriptionCheckout,
  updatePlatformBillingStatusByCustomer,
} from "@/lib/stripe/handlePlatformBilling";

// Eventos de la cuenta PRINCIPAL de la plataforma: ventas de curso de
// organizaciones que todavía no han conectado su propia cuenta de Stripe
// (Fase 5), y desde la Fase 6, la suscripción mensual de la plataforma.
// Las ventas de organizaciones ya conectadas llegan al webhook de Connect
// (src/app/api/webhooks/stripe-connect/route.ts), no aquí.
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await handlePlatformSubscriptionCheckout(session);
      } else {
        await handleCheckoutSessionCompleted(session);
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
