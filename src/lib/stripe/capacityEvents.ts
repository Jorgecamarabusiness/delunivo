import "server-only";
import type Stripe from "stripe";
import { stripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, offerSnapshot } from "@/lib/billing/catalog";
import { capacityPrice } from "./capacityPrices";
import { reconcileCapacityOperation } from "./capacityBilling";
const id = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

export async function reconcileCapacitySubscription(
  organizationId: string,
  subscriptionId: string,
  invoiceId: string,
) {
  const admin = createAdminClient();
  const billing = await admin
    .from("organization_billing")
    .select("offer_version,platform_subscription_id,effective_discount_percent")
    .eq("organization_id", organizationId)
    .single();
  if (billing.error) throw new Error(billing.error.message);
  if (
    !billing.data.offer_version ||
    billing.data.platform_subscription_id !== subscriptionId
  )
    return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.lines.has_more) {
    const lines: Stripe.InvoiceLineItem[] = [];
    for await (const line of stripe.invoices.listLineItems(invoice.id, {
      limit: 100,
    }))
      lines.push(line);
    invoice.lines.data = lines;
    invoice.lines.has_more = false;
  }
  if (
    invoice.status !== "paid" ||
    id(invoice.parent?.subscription_details?.subscription) !==
      subscription.id ||
    id(invoice.customer) !== id(subscription.customer)
  )
    throw new Error("Factura de renovación inválida.");
  // Apply a paid in-cycle operation before deciding whether this is a renewal.
  if (subscription.metadata.capacity_operation_id)
    await reconcileCapacityOperation(
      subscription.metadata.capacity_operation_id,
    );
  const prices = await Promise.all(
    PLANS.map((plan) => capacityPrice(plan.key)),
  );
  const baseIndex = prices.findIndex((price) =>
    subscription.items.data.some((item) => item.price.id === price.id),
  );
  if (baseIndex < 0) throw new Error("Plan Stripe sin atribución comercial.");
  const item = subscription.items.data.find(
    (i) => i.price.id === prices[baseIndex].id,
  )!;
  const library = await capacityPrice("library");
  const quantity =
    subscription.items.data.find((i) => i.price.id === library.id)?.quantity ??
    0;
  if (
    invoice.billing_reason === "subscription_cycle" ||
    invoice.billing_reason === "subscription_create"
  ) {
    // A late paid invoice belongs to its line period, never the current provider period.
    const line = invoice.lines.data.find(
      (l) =>
        l.pricing?.price_details?.price === item.price.id &&
        !l.parent?.subscription_item_details?.proration,
    );
    if (!line)
      throw new Error("Periodo de renovación pendiente de atribución.");
    if (
      line.period.start !== item.current_period_start ||
      line.period.end !== item.current_period_end
    ) {
      // Old cycles retain the immutable plan accepted then; they cannot change today's plan.
      const known = await admin
        .from("platform_capacity_cycles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("starts_at", new Date(line.period.start * 1000).toISOString())
        .maybeSingle();
      if (!known.data)
        throw new Error(
          "Factura histórica requiere conciliación del ciclo original.",
        );
    } else {
      const applied = await admin.rpc("renew_platform_capacity_cycle", {
        p_organization_id: organizationId,
        p_subscription_id: subscriptionId,
        p_start: new Date(line.period.start * 1000).toISOString(),
        p_end: new Date(line.period.end * 1000).toISOString(),
        p_offer: offerSnapshot(
          PLANS[baseIndex].key,
          Number(billing.data.effective_discount_percent),
        ),
        p_library_quantity: quantity,
        p_paid_cents: invoice.amount_paid,
      });
      if (applied.error) throw new Error(applied.error.message);
    }
  }
  const saved = await admin.from("platform_invoice_ledger").upsert(
    {
      invoice_id: invoice.id,
      organization_id: organizationId,
      subscription_id: subscriptionId,
      currency: invoice.currency,
      amount_paid_cents: invoice.amount_paid,
      total_cents: invoice.total,
      paid_at: new Date(
        (invoice.status_transitions.paid_at ?? invoice.created) * 1000,
      ).toISOString(),
      period_start: new Date(invoice.period_start * 1000).toISOString(),
      period_end: new Date(invoice.period_end * 1000).toISOString(),
      provider_snapshot: {
        amount_paid: invoice.amount_paid,
        total: invoice.total,
        total_discount_amounts: invoice.total_discount_amounts,
        total_taxes: invoice.total_taxes,
      },
    },
    { onConflict: "invoice_id" },
  );
  if (saved.error) throw new Error(saved.error.message);
}

export async function handleCapacityRefund(eventCharge: Stripe.Charge) {
  const charge = await stripe.charges.retrieve(eventCharge.id);
  const intentId = id(charge.payment_intent);
  if (!intentId) return;
  const intent = await stripe.paymentIntents.retrieve(intentId);
  const operationId = intent.metadata.capacity_operation_id;
  if (!operationId) return;
  const admin = createAdminClient();
  const op = await admin
    .from("platform_billing_operations")
    .select("id,organization_id,kind,checkout_attempt_id")
    .eq("id", operationId)
    .maybeSingle();
  if (op.error) throw new Error(op.error.message);
  if (!op.data || op.data.kind !== "delivery_pack") return;
  const attempt = await admin
    .from("stripe_checkout_attempts")
    .select("stripe_session_id")
    .eq("id", op.data.checkout_attempt_id)
    .single();
  if (attempt.error) throw new Error(attempt.error.message);
  for await (const refund of stripe.refunds.list({
    charge: charge.id,
    limit: 100,
  })) {
    if (refund.status !== "succeeded") continue;
    const applied = await admin.rpc("refund_platform_delivery_pack", {
      p_source_id: attempt.data.stripe_session_id,
      p_refund_cents: refund.amount,
      p_refunded_at: new Date(refund.created * 1000).toISOString(),
      p_refund_id: refund.id,
    });
    if (applied.error) throw new Error(applied.error.message);
  }
}
