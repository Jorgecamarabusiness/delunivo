import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import {
  handlePlatformSubscriptionCheckout,
  invoiceSubscriptionId,
  updatePlatformBillingStatusForSubscription,
} from "@/lib/stripe/handlePlatformBilling";
import { syncOrganizationDiscountToStripe } from "@/lib/stripe/platformDiscounts";
import { fulfilCapacityCheckout, reconcileCapacityOperation } from "@/lib/stripe/capacityBilling";
import { reconcileCapacitySubscription, handleCapacityRefund } from "@/lib/stripe/capacityEvents";
import { applyPaidAffiliateInvoice } from "@/lib/stripe/paidAffiliateInvoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleCapacityCheckouts } from "@/lib/stripe/capacityBilling";
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
    "checkout.session.expired",
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.deleted",
    "customer.subscription.updated",
    "customer.subscription.pending_update_applied",
    "customer.subscription.pending_update_expired",
    "charge.refunded",
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
        await fulfilCapacityCheckout(session);
      } else if (session.metadata?.capacity_operation_id) {
        await fulfilCapacityCheckout(session);
      } else {
        throw new Error(
          "Una venta de curso ha llegado a la cuenta principal; se rechaza por seguridad."
        );
      }
    }
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.capacity_operation_id && session.metadata.organization_id) await settleCapacityCheckouts(session.metadata.organization_id);
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
        await reconcileCapacitySubscription(organizationId, invoiceSubscriptionId(invoice)!, invoice.id);
        await applyPaidAffiliateInvoice(organizationId, invoice);
      }
    }

    if (["customer.subscription.updated", "customer.subscription.pending_update_applied", "customer.subscription.pending_update_expired"].includes(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      // Fetch current provider state. A stale payload cannot revert a paid plan.
      if (subscription.metadata.capacity_operation_id) await reconcileCapacityOperation(subscription.metadata.capacity_operation_id);
    }
    if (event.type === "charge.refunded") await handleCapacityRefund(event.data.object as Stripe.Charge);

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
        const current = await stripe.subscriptions.retrieve(subscription.id);
        if (current.status !== "canceled" || !current.ended_at) throw new Error("Subscription termination unconfirmed");
        const reconciled = await createAdminClient().rpc("reconcile_platform_retention", { p_organization_id: organizationId, p_confirmed_end: new Date(current.ended_at * 1000).toISOString() });
        if (reconciled.error) throw new Error(reconciled.error.message);
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
      { error: "No se pudo procesar el webhook." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
