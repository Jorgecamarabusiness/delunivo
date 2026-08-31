import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import {
  handlePlatformSubscriptionCheckout,
  invoiceSubscriptionId,
  updatePlatformBillingStatusForSubscription,
} from "@/lib/stripe/handlePlatformBilling";
import { syncOrganizationDiscountToStripe } from "@/lib/stripe/platformDiscounts";
import {
  applyPlatformAffiliateEvent,
  claimPlatformWebhookEvent,
  completePlatformWebhookEvent,
  failPlatformWebhookEvent,
} from "@/lib/stripe/platformWebhookEvents";

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

  const handledTypes = new Set<Stripe.Event.Type>([
    "checkout.session.completed",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.deleted",
  ]);
  if (!handledTypes.has(event.type)) {
    return NextResponse.json({ received: true, ignored: "unsupported_event" });
  }

  let claimed = false;
  try {
    const claim = await claimPlatformWebhookEvent(event.id, event.type);
    if (claim === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claim === "in_progress") {
      // 503 obliga a Stripe a reintentar: responder 2xx aquí podría perder el
      // evento si el primer proceso cayó después de reclamarlo.
      return NextResponse.json(
        { error: "El evento ya se está procesando; reintenta." },
        { status: 503 }
      );
    }
    claimed = true;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await handlePlatformSubscriptionCheckout(
          session,
          new Date(event.created * 1000)
        );
      } else {
        throw new Error(
          "Una venta de curso ha llegado a la cuenta principal; se rechaza por seguridad."
        );
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const organizationId = await updatePlatformBillingStatusForSubscription(
        invoice.customer,
        invoiceSubscriptionId(invoice),
        "active",
        new Date(event.created * 1000)
      );
      if (organizationId) {
        const affected = await applyPlatformAffiliateEvent({
          eventId: event.id,
          organizationId,
          eventKind: "invoice_paid",
          eventAt: new Date(event.created * 1000),
          amountPaid: invoice.amount_paid,
        });
        for (const affectedOrganizationId of affected) {
          await syncOrganizationDiscountToStripe(
            affectedOrganizationId,
            event.id
          );
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const organizationId = await updatePlatformBillingStatusForSubscription(
        invoice.customer,
        invoiceSubscriptionId(invoice),
        "past_due",
        new Date(event.created * 1000)
      );
      if (organizationId) {
        const affected = await applyPlatformAffiliateEvent({
          eventId: event.id,
          organizationId,
          eventKind: "payment_failed",
          eventAt: new Date(event.created * 1000),
        });
        for (const affectedOrganizationId of affected) {
          await syncOrganizationDiscountToStripe(
            affectedOrganizationId,
            event.id
          );
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = await updatePlatformBillingStatusForSubscription(
        subscription.customer,
        subscription.id,
        "canceled",
        new Date(event.created * 1000)
      );
      if (organizationId) {
        const affected = await applyPlatformAffiliateEvent({
          eventId: event.id,
          organizationId,
          eventKind: "subscription_deleted",
          eventAt: new Date(event.created * 1000),
        });
        for (const affectedOrganizationId of affected) {
          await syncOrganizationDiscountToStripe(
            affectedOrganizationId,
            event.id
          );
        }
      }
    }

    await completePlatformWebhookEvent(event.id);
  } catch (error) {
    if (claimed) await failPlatformWebhookEvent(event.id, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
