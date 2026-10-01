import "server-only";
import type Stripe from "stripe";
import { applyPlatformAffiliateEvent, claimPlatformWebhookEvent, completePlatformWebhookEvent, failPlatformWebhookEvent } from "./platformWebhookEvents";
import { syncOrganizationDiscountToStripe } from "./platformDiscounts";

/** Invoice identity coordinates webhook and recovery; event delivery order is irrelevant. */
export async function applyPaidAffiliateInvoice(organizationId: string, invoice: Stripe.Invoice) {
  if (invoice.status !== "paid") throw new Error("Factura sin pago confirmado.");
  const key = `delunivo-paid-invoice-${invoice.id}`;
  const claim = await claimPlatformWebhookEvent(key, "invoice.paid.reconciled");
  if (claim === "duplicate") return;
  if (claim === "in_progress") throw new Error("Factura en conciliación concurrente.");
  try {
    const affected = await applyPlatformAffiliateEvent({ eventId: key, organizationId, eventKind: "invoice_paid",
      eventAt: new Date((invoice.status_transitions.paid_at ?? invoice.created) * 1000), amountPaid: invoice.amount_paid });
    for (const id of affected) await syncOrganizationDiscountToStripe(id, key);
    await completePlatformWebhookEvent(key);
  } catch (error) { await failPlatformWebhookEvent(key, error); throw error; }
}
