import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlan,
  offerSnapshot,
  DELIVERY_PACK,
  type PlanKey,
} from "@/lib/billing/catalog";
import { stripe } from "./client";
import { capacityPrice, platformTaxRates } from "./capacityPrices";
import { ensureOrganizationDiscountCoupon } from "./platformDiscounts";
import {
  claimCheckoutAttempt,
  getCheckoutUrlForAttempt,
  markCheckoutAttemptCompleted,
} from "./checkoutAttempts";
import { handlePlatformSubscriptionCheckout } from "./handlePlatformBilling";
import { applyPaidAffiliateInvoice } from "./paidAffiliateInvoice";
import { reconcileCapacitySubscription } from "./capacityEvents";
import { plansEnabledForSchool } from "@/lib/billing/rollout";
import { readAllRows } from "@/lib/billing/readAllRows";

type ChangeKind = "upgrade" | "downgrade" | "library" | "cancel" | "resume";
type Quote = {
  subscriptionId: string;
  fingerprint: string;
  planKey: PlanKey;
  libraryQuantity: number;
  prorationAt: string;
  cycleStart: string;
  cycleEnd: string;
  initialCents: number;
  recurringCents: number;
  currency: string;
  items: Stripe.SubscriptionUpdateParams.Item[];
  currentItems?: { price: string; quantity: number }[];
  discountIds?: string[];
  taxRates?: string[];
};
type Operation = {
  actor_id: string | null;
  id: string;
  organization_id: string;
  kind: string;
  status: string;
  quote: Quote;
  offer_snapshot: ReturnType<typeof offerSnapshot>;
  stripe_params: Stripe.Checkout.SessionCreateParams;
  provider_id: string | null;
  invoice_id: string | null;
  applied_at: string | null;
  expires_at: string;
};
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
const identifier = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

function plansEnabled(organizationId: string) {
  if (!plansEnabledForSchool(organizationId))
    throw new Error("Los nuevos planes todavía no están activados.");
}
function fingerprint(subscription: Stripe.Subscription) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        status: subscription.status,
        cancel: subscription.cancel_at_period_end,
        items: subscription.items.data.map((i) => [
          i.id,
          i.price.id,
          i.quantity,
          i.current_period_start,
          i.current_period_end,
        ]),
        discounts: subscription.discounts.map(identifier),
        pending: subscription.pending_update,
        schedule: identifier(subscription.schedule),
      }),
    )
    .digest("hex");
}
async function billingRow(organizationId: string) {
  const result = await createAdminClient()
    .from("organization_billing")
    .select("*")
    .eq("organization_id", organizationId)
    .single();
  if (result.error || !result.data)
    throw new Error("No se pudo verificar la facturación de la escuela.");
  return result.data;
}
async function insertOperation(input: {
  organizationId: string;
  userId: string;
  kind: string;
  quote: object;
  snapshot: object;
  stripeParams?: object;
}) {
  const saved = await createAdminClient()
    .from("platform_billing_operations")
    .insert({
      id: randomUUID(),
      organization_id: input.organizationId,
      actor_id: input.userId,
      kind: input.kind,
      quote: input.quote,
      offer_snapshot: input.snapshot,
      stripe_params: input.stripeParams ?? {},
      expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
    })
    .select("*")
    .single();
  if (saved.error || !saved.data)
    throw new Error("No se pudo guardar la oferta de pago.");
  return saved.data as Operation;
}

export async function createCapacityCheckout(
  organizationId: string,
  userId: string,
  key: PlanKey | "delivery_pack",
) {
  plansEnabled(organizationId);
  const billing = await billingRow(organizationId);
  const pack = key === "delivery_pack";
  if (
    pack &&
    (!billing.offer_version ||
      !billing.platform_subscription_id ||
      !["active", "past_due"].includes(billing.platform_subscription_status))
  )
    throw new Error(
      "La bolsa requiere un plan vigente. No renueva la suscripción.",
    );
  if (
    !pack &&
    billing.platform_subscription_id &&
    ["active", "trialing", "past_due"].includes(
      billing.platform_subscription_status,
    )
  )
    throw new Error("Esta escuela ya tiene suscripción. Utiliza Cambiar plan.");
  const price = await capacityPrice(key);
  const rates = await platformTaxRates();
  const discount = pack
    ? { couponId: null, effectivePercent: 0 }
    : await ensureOrganizationDiscountCoupon(organizationId);
  const snapshot = pack
    ? { ...billing.accepted_offer, deliveryPack: DELIVERY_PACK }
    : offerSnapshot(key as PlanKey, discount.effectivePercent);
  const operation = await insertOperation({
    organizationId,
    userId,
    kind: pack ? "delivery_pack" : "subscribe",
    quote: {
      planKey: key,
      initialCents: pack
        ? 2000
        : Math.round(
            (price.unit_amount! * (100 - discount.effectivePercent)) / 100,
          ),
    },
    snapshot,
  });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: pack ? "payment" : "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: price.id,
        quantity: 1,
        ...(rates.length ? { tax_rates: rates } : {}),
      },
    ],
    success_url: `${site}/admin/facturacion?empresa=${organizationId}&checkout=success`,
    cancel_url: `${site}/admin/facturacion?empresa=${organizationId}&checkout=cancelled`,
    client_reference_id: userId,
    billing_address_collection: "required",
    metadata: {
      organization_id: organizationId,
      user_id: userId,
      capacity_operation_id: operation.id,
      offer_version: snapshot.version,
    },
    ...(billing.platform_stripe_customer_id
      ? { customer: billing.platform_stripe_customer_id }
      : {}),
    ...(discount.couponId
      ? { discounts: [{ coupon: discount.couponId }] }
      : {}),
    ...(pack
      ? {
          payment_intent_data: {
            metadata: {
              organization_id: organizationId,
              capacity_operation_id: operation.id,
            },
          },
        }
      : {
          subscription_data: {
            metadata: {
              organization_id: organizationId,
              offer_version: snapshot.version,
            },
          },
        }),
  };
  const attempt = await claimCheckoutAttempt({
    checkoutKind: pack ? "platform_delivery_pack" : "platform_subscription",
    organizationId,
    userId,
    courseId: null,
    stripeAccountId: null,
    stripeParams: params,
    expectedAmountTotal: pack ? 2000 : null,
    expectedCurrency: "eur",
  });
  const actualOperationId =
    attempt.stripe_params.metadata?.capacity_operation_id;
  if (
    !actualOperationId ||
    attempt.stripe_params.line_items?.[0]?.price !== price.id
  )
    throw new Error(
      "Hay un checkout anterior pendiente. Completa o cierra esa oferta antes de elegir otra.",
    );
  const saved = await createAdminClient()
    .from("platform_billing_operations")
    .update({
      checkout_attempt_id: attempt.id,
      stripe_params: attempt.stripe_params,
      status: "processing",
    })
    .eq("id", actualOperationId)
    .in("status", ["quoted", "processing"]);
  if (saved.error) throw new Error("No se pudo coordinar el pago.");
  return getCheckoutUrlForAttempt(attempt);
}

export async function quoteCapacityChange(
  organizationId: string,
  userId: string,
  kind: ChangeKind,
  targetKey?: PlanKey,
  libraryQuantity?: number,
) {
  plansEnabled(organizationId);
  const billing = await billingRow(organizationId);
  if (!billing.offer_version || !getPlan(billing.plan_key))
    throw new Error(
      "Esta escuela conserva una oferta anterior. Su transición requiere una oferta explícita del administrador.",
    );
  if (!billing.platform_subscription_id)
    throw new Error("No hay suscripción activa.");
  const subscription = await stripe.subscriptions.retrieve(
    billing.platform_subscription_id,
  );
  if (subscription.status !== "active" || subscription.pending_update)
    throw new Error("Primero resuelve el pago pendiente de la suscripción.");
  if (subscription.schedule && kind !== "cancel" && kind !== "resume")
    throw new Error(
      "Ya hay un cambio programado. Cancela la programación antes de preparar otro cambio.",
    );
  const current = getPlan(billing.plan_key)!;
  const target = getPlan(
    ["library", "cancel", "resume"].includes(kind)
      ? current.key
      : (targetKey ?? current.key),
  );
  if (!target) throw new Error("Plan inválido.");
  if (
    (kind === "upgrade" && target.priceCents <= current.priceCents) ||
    (kind === "downgrade" && target.priceCents >= current.priceCents)
  )
    throw new Error("Dirección de cambio inválida.");
  const quantity = libraryQuantity ?? billing.library_extension_quantity;
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100)
    throw new Error("Cantidad de ampliaciones inválida.");
  if (kind === "library" && quantity < billing.library_extension_quantity)
    kind = "downgrade";
  if (kind === "downgrade") {
    const usage = await createAdminClient().rpc("platform_library_usage", {
      p_organization_id: organizationId,
    });
    if (usage.error) throw new Error("No se pudo comprobar la biblioteca.");
    if (Number(usage.data.unconfirmed_assets) > 0)
      throw new Error(
        "Confirma primero las duraciones pendientes de la biblioteca antes de reducir capacidad.",
      );
    if (
      Number(usage.data.active_seconds) + Number(usage.data.reserved_seconds) >
      target.libraryHours * 3600 + quantity * 36000
    )
      throw new Error(
        "La biblioteca no cabe en la capacidad elegida. Mantén ampliaciones o reduce contenido antes de programar el cambio.",
      );
  }
  const basePrice = await capacityPrice(current.key),
    nextPrice = await capacityPrice(target.key),
    libraryPrice = await capacityPrice("library");
  const baseItem = subscription.items.data.find(
    (i) => i.price.id === basePrice.id,
  );
  const libraryItem = subscription.items.data.find(
    (i) => i.price.id === libraryPrice.id,
  );
  if (
    !baseItem ||
    subscription.items.data.some(
      (i) => ![basePrice.id, libraryPrice.id].includes(i.price.id),
    )
  )
    throw new Error(
      "La suscripción tiene líneas no reconocidas. Concíliala antes del cambio.",
    );
  const items: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: baseItem.id, price: nextPrice.id, quantity: 1 },
    ...(libraryItem
      ? [
          {
            id: libraryItem.id,
            ...(quantity
              ? { price: libraryPrice.id, quantity }
              : { deleted: true }),
          },
        ]
      : quantity
        ? [{ price: libraryPrice.id, quantity }]
        : []),
  ];
  const prorationDate = Math.floor(Date.now() / 1000);
  let initialCents = 0;
  const recurringPreview = await stripe.invoices.createPreview({
    customer: identifier(subscription.customer)!,
    subscription: subscription.id,
    subscription_details: { items, proration_behavior: "none" },
  });
  if (recurringPreview.currency !== "eur")
    throw new Error("Moneda recurrente incorrecta.");
  if (kind === "upgrade" || kind === "library") {
    const preview = await stripe.invoices.createPreview({
      customer: identifier(subscription.customer)!,
      subscription: subscription.id,
      subscription_details: {
        items,
        proration_date: prorationDate,
        proration_behavior: "always_invoice",
      },
    });
    if (preview.currency !== "eur")
      throw new Error("Moneda de previsualización incorrecta.");
    initialCents = preview.amount_due;
  }
  const quote: Quote = {
    subscriptionId: subscription.id,
    fingerprint: fingerprint(subscription),
    planKey: target.key,
    libraryQuantity: quantity,
    prorationAt: iso(prorationDate),
    cycleStart: iso(baseItem.current_period_start),
    cycleEnd: iso(baseItem.current_period_end),
    initialCents,
    recurringCents: kind === "cancel" ? 0 : recurringPreview.total,
    currency: "eur",
    items,
    currentItems: subscription.items.data.map((i) => ({
      price: i.price.id,
      quantity: i.quantity ?? 1,
    })),
    discountIds: subscription.discounts.map((d) => identifier(d)!),
    taxRates: await platformTaxRates(),
  };
  return insertOperation({
    organizationId,
    userId,
    kind,
    quote,
    snapshot: offerSnapshot(
      target.key,
      Number(billing.effective_discount_percent),
    ),
  });
}

export async function confirmCapacityChange(
  organizationId: string,
  operationId: string,
  userId: string,
) {
  plansEnabled(organizationId);
  const admin = createAdminClient();
  const result = await admin
    .from("platform_billing_operations")
    .select("*")
    .eq("id", operationId)
    .eq("organization_id", organizationId)
    .single();
  if (result.error || !result.data) throw new Error("Oferta no encontrada.");
  const op = result.data as Operation;
  if (op.actor_id !== userId)
    throw new Error(
      "Esta oferta pertenece a otro propietario. Solicita una nueva previsualización.",
    );
  if (op.status === "completed" || op.status === "scheduled")
    return { url: null, status: op.status };
  if (op.status !== "quoted" || Date.parse(op.expires_at) <= Date.now())
    throw new Error(
      "La previsualización ha caducado o ya se está procesando. Actualízala.",
    );
  const subscription = await stripe.subscriptions.retrieve(
    op.quote.subscriptionId,
  );
  if (fingerprint(subscription) !== op.quote.fingerprint)
    throw new Error(
      "La suscripción ha cambiado. Solicita una nueva previsualización.",
    );
  const claimed = await admin
    .from("platform_billing_operations")
    .update({ status: "processing" })
    .eq("id", op.id)
    .eq("status", "quoted")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (claimed.error || !claimed.data)
    throw new Error("Ya hay una operación en curso para esta escuela.");
  try {
    if (op.kind === "downgrade") {
      const created = await stripe.subscriptionSchedules.create(
        { from_subscription: subscription.id },
        { idempotencyKey: `delunivo-schedule-${op.id}` },
      );
      const bound = await admin
        .from("platform_billing_operations")
        .update({ provider_id: created.id })
        .eq("id", op.id);
      if (bound.error) throw new Error(bound.error.message);
      await stripe.subscriptionSchedules.update(
        created.id,
        { metadata: { capacity_operation_id: op.id } },
        { idempotencyKey: `delunivo-schedule-binding-${op.id}` },
      );
      const library = await capacityPrice("library"),
        next = await capacityPrice(op.quote.planKey);
      const discounts = (op.quote.discountIds ?? []).map((d) => ({
        discount: d,
      }));
      const rates = op.quote.taxRates ?? [];
      const scheduled = await stripe.subscriptionSchedules.update(
        created.id,
        {
          end_behavior: "release",
          phases: [
            {
              start_date: created.current_phase!.start_date,
              end_date: Math.floor(Date.parse(op.quote.cycleEnd) / 1000),
              items: op.quote.currentItems!,
              discounts,
              default_tax_rates: rates,
              proration_behavior: "none",
            },
            {
              items: [
                { price: next.id, quantity: 1 },
                ...(op.quote.libraryQuantity
                  ? [{ price: library.id, quantity: op.quote.libraryQuantity }]
                  : []),
              ],
              discounts,
              default_tax_rates: rates,
              proration_behavior: "none",
              duration: { interval: "month", interval_count: 1 },
            },
          ],
        },
        { idempotencyKey: `delunivo-schedule-phases-${op.id}` },
      );
      const saved = await admin
        .from("organization_billing")
        .update({
          scheduled_plan_key: op.quote.planKey,
          scheduled_library_quantity: op.quote.libraryQuantity,
          stripe_schedule_id: scheduled.id,
        })
        .eq("organization_id", organizationId);
      if (saved.error) throw new Error(saved.error.message);
      const done = await admin
        .from("platform_billing_operations")
        .update({ status: "scheduled", provider_id: scheduled.id })
        .eq("id", op.id);
      if (done.error) throw new Error(done.error.message);
      return { url: null, status: "scheduled" };
    }
    if (op.kind === "cancel" || op.kind === "resume") {
      if (subscription.schedule)
        await stripe.subscriptionSchedules.release(
          identifier(subscription.schedule)!,
          {},
          { idempotencyKey: `delunivo-release-${op.id}` },
        );
      await stripe.subscriptions.update(
        subscription.id,
        { cancel_at_period_end: op.kind === "cancel" },
        { idempotencyKey: `delunivo-cancel-${op.id}` },
      );
      const cleared = await admin
        .from("organization_billing")
        .update({
          scheduled_plan_key: null,
          scheduled_library_quantity: null,
          stripe_schedule_id: null,
        })
        .eq("organization_id", organizationId);
      if (cleared.error) throw new Error(cleared.error.message);
      const saved = await admin
        .from("platform_billing_operations")
        .update({
          status: "completed",
          provider_id: subscription.id,
          applied_at: new Date().toISOString(),
        })
        .eq("id", op.id);
      if (saved.error) throw new Error(saved.error.message);
      return { url: null, status: "completed" };
    }
    const updated = await stripe.subscriptions.update(
      subscription.id,
      {
        items: op.quote.items,
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        proration_date: Math.floor(Date.parse(op.quote.prorationAt) / 1000),
        metadata: { capacity_operation_id: op.id },
        expand: ["latest_invoice"],
      },
      { idempotencyKey: `delunivo-capacity-change-${op.id}` },
    );
    const invoiceId = identifier(updated.latest_invoice);
    if (!invoiceId)
      throw new Error("Stripe no devolvió la factura del cambio.");
    const saved = await admin
      .from("platform_billing_operations")
      .update({
        provider_id: updated.id,
        invoice_id: invoiceId,
        status: "pending_payment",
      })
      .eq("id", op.id);
    if (saved.error) throw new Error(saved.error.message);
    await reconcileCapacityOperation(op.id);
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      url:
        invoice.status === "paid" ? null : (invoice.hosted_invoice_url ?? null),
      status: invoice.status === "paid" ? "completed" : "pending_payment",
    };
  } catch (error) {
    // Preserve processing for reconciliation when Stripe may already have succeeded.
    await admin
      .from("platform_billing_operations")
      .update({
        last_error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "provider_update_failed",
      })
      .eq("id", op.id);
    throw error;
  }
}

export async function fulfilCapacityCheckout(session: Stripe.Checkout.Session) {
  const id = session.metadata?.capacity_operation_id;
  if (!id) return false;
  const admin = createAdminClient();
  const result = await admin
    .from("platform_billing_operations")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error || !result.data)
    throw new Error("No existe la oferta aceptada.");
  const op = result.data as Operation;
  const attempt = await admin
    .from("stripe_checkout_attempts")
    .select("*")
    .eq("stripe_session_id", session.id)
    .eq("organization_id", op.organization_id)
    .maybeSingle();
  if (
    attempt.error ||
    !attempt.data ||
    attempt.data.stripe_account_id ||
    session.metadata?.organization_id !== op.organization_id ||
    session.currency !== "eur" ||
    session.status !== "complete" ||
    session.client_reference_id !==
      (attempt.data.user_id ?? attempt.data.historical_user_id)
  )
    throw new Error("Checkout de capacidad inválido.");
  const pack = op.kind === "delivery_pack";
  if (
    pack &&
    (session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.amount_total !== 2000)
  )
    throw new Error("Bolsa sin pago confirmado.");
  if (
    !pack &&
    (session.mode !== "subscription" ||
      !["paid", "no_payment_required"].includes(session.payment_status))
  )
    throw new Error("Suscripción sin pago confirmado.");
  const lines = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
  });
  if (
    lines.has_more ||
    lines.data.length !== 1 ||
    lines.data[0].quantity !== 1 ||
    lines.data[0].price?.id !==
      attempt.data.stripe_params.line_items?.[0]?.price
  )
    throw new Error("El precio pagado no coincide con la oferta.");
  const confirmedAt = iso(session.created);
  if (pack) {
    const intent = await stripe.paymentIntents.retrieve(
      identifier(session.payment_intent)!,
    );
    if (
      intent.status !== "succeeded" ||
      intent.amount_received !== 2000 ||
      intent.currency !== "eur"
    )
      throw new Error("Pago de bolsa no confirmado.");
    // First server verification activates the bag; charge creation can precede capture.
    const charge = await stripe.charges.retrieve(
      identifier(intent.latest_charge)!,
    );
    if (!charge.paid || !charge.captured)
      throw new Error("Cobro de bolsa sin captura confirmada.");
    const refunds: { id: string; amount: number; created: string }[] = [];
    for await (const refund of stripe.refunds.list({
      charge: charge.id,
      limit: 100,
    }))
      if (refund.status === "succeeded")
        refunds.push({
          id: refund.id,
          amount: refund.amount,
          created: iso(refund.created),
        });
    const saved = await admin.rpc("fulfil_platform_delivery_payment", {
      p_operation_id: id,
      p_confirmed_at: new Date().toISOString(),
      p_source_id: session.id,
      p_snapshot: {
        currency: session.currency,
        paid_cents: session.amount_total,
        tax_cents: session.total_details?.amount_tax ?? null,
        payment_intent_id: intent.id,
        charge_id: charge.id,
      },
      p_refunds: refunds,
    });
    if (saved.error) throw new Error(saved.error.message);
  } else {
    const subscriptionId = identifier(session.subscription)!;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    if (
      subscription.status !== "active" ||
      !invoice ||
      invoice.status !== "paid"
    )
      throw new Error("Factura inicial pendiente.");
    const item = subscription.items.data.find(
      (i) => i.price.id === lines.data[0].price?.id,
    );
    if (!item) throw new Error("El plan pagado no aparece en la suscripción.");
    const saved = await admin.rpc("apply_platform_capacity_payment", {
      p_operation_id: id,
      p_subscription_id: subscriptionId,
      p_cycle_start: iso(item.current_period_start),
      p_cycle_end: iso(item.current_period_end),
      p_confirmed_at: iso(
        invoice.status_transitions.paid_at ?? session.created,
      ),
      p_source_id: invoice.id,
    });
    if (saved.error) throw new Error(saved.error.message);
    await applyPaidAffiliateInvoice(op.organization_id, invoice);
    await reconcileCapacitySubscription(
      op.organization_id,
      subscriptionId,
      invoice.id,
    );
  }
  await markCheckoutAttemptCompleted(attempt.data.id);
  void confirmedAt;
  return true;
}

export async function settleCapacityCheckouts(organizationId: string) {
  const admin = createAdminClient();
  const attempts = await readAllRows((from, to) =>
    admin
      .from("stripe_checkout_attempts")
      .select("*")
      .eq("organization_id", organizationId)
      .in("checkout_kind", ["platform_subscription", "platform_delivery_pack"])
      .in("status", ["creating", "open", "expired", "failed", "completed"])
      .order("id")
      .range(from, to),
  );
  if (attempts.error) throw new Error(attempts.error.message);
  for (const attempt of attempts.data ?? []) {
    const operationId = attempt.stripe_params?.metadata?.capacity_operation_id;
    if (!operationId) continue;
    if (attempt.status === "completed") {
      const operation = await admin
        .from("platform_billing_operations")
        .select("applied_at")
        .eq("id", operationId)
        .single();
      if (operation.error) throw new Error(operation.error.message);
      if (operation.data.applied_at) continue;
    }
    if (!attempt.stripe_session_id) {
      // Unknown provider creation is recovered with the existing attempt/key by createCapacityCheckout.
      continue;
    }
    const session = await stripe.checkout.sessions.retrieve(
      attempt.stripe_session_id,
    );
    if (session.status === "complete") {
      if (session.mode === "subscription")
        await handlePlatformSubscriptionCheckout(
          session,
          new Date(session.created * 1000),
        );
      await fulfilCapacityCheckout(session);
    } else if (session.status === "expired") {
      const savedAttempt = await admin
        .from("stripe_checkout_attempts")
        .update({ status: "expired" })
        .eq("id", attempt.id)
        .in("status", ["creating", "open"]);
      const savedOperation = await admin
        .from("platform_billing_operations")
        .update({ status: "expired" })
        .eq("id", operationId)
        .is("applied_at", null);
      if (savedAttempt.error || savedOperation.error)
        throw new Error("No se pudo conciliar el checkout caducado.");
    }
  }
}

/** Owner actions use the offer's bound provider resources. */
export async function recoverCapacityPayment(
  organizationId: string,
  operationId: string,
  action: "reconcile" | "continue" | "expire",
) {
  const admin = createAdminClient();
  const found = await admin
    .from("platform_billing_operations")
    .select("*")
    .eq("id", operationId)
    .eq("organization_id", organizationId)
    .single();
  if (found.error || !found.data) throw new Error("Operación no encontrada.");
  const op = found.data;
  if (op.checkout_attempt_id) {
    const attempt = await admin
      .from("stripe_checkout_attempts")
      .select("*")
      .eq("id", op.checkout_attempt_id)
      .eq("organization_id", organizationId)
      .single();
    if (attempt.error || !attempt.data || attempt.data.stripe_account_id)
      throw new Error("Pago sin atribución segura.");
    if (!attempt.data.stripe_session_id && action === "reconcile")
      throw new Error(
        "El pago está pendiente de recuperar. Utiliza Continuar pago.",
      );
    if (!attempt.data.stripe_session_id)
      await getCheckoutUrlForAttempt(attempt.data);
    const refreshed = await admin
      .from("stripe_checkout_attempts")
      .select("stripe_session_id")
      .eq("id", attempt.data.id)
      .single();
    if (refreshed.error || !refreshed.data?.stripe_session_id)
      throw new Error("Pago pendiente de conciliación.");
    let session = await stripe.checkout.sessions.retrieve(
      refreshed.data.stripe_session_id,
    );
    if (action === "expire" && session.status === "open") {
      try {
        session = await stripe.checkout.sessions.expire(session.id);
      } catch {
        session = await stripe.checkout.sessions.retrieve(session.id);
      }
    }
    await settleCapacityCheckouts(organizationId);
    if (action === "continue" && session.status === "open")
      return session.url ?? null;
    if (action === "expire" && session.status === "open")
      throw new Error(
        "El proveedor todavía no ha confirmado el cierre del pago.",
      );
    return null;
  }
  if (action === "expire")
    throw new Error(
      "Esta operación corresponde a una suscripción y requiere conciliar su factura.",
    );
  await reconcileCapacityOperation(operationId);
  const current = await admin
    .from("platform_billing_operations")
    .select("status,invoice_id")
    .eq("id", operationId)
    .eq("organization_id", organizationId)
    .single();
  if (current.error) throw new Error("Operación pendiente de conciliación.");
  if (
    action === "continue" &&
    current.data.invoice_id &&
    current.data.status === "pending_payment"
  ) {
    const billing = await billingRow(organizationId);
    const invoice = await stripe.invoices.retrieve(current.data.invoice_id);
    if (
      identifier(invoice.customer) !== billing.platform_stripe_customer_id ||
      identifier(invoice.parent?.subscription_details?.subscription) !==
        billing.platform_subscription_id
    )
      throw new Error("Factura sin atribución segura.");
    return invoice.status === "open"
      ? (invoice.hosted_invoice_url ?? null)
      : null;
  }
  return null;
}

export async function reconcileCapacityOperation(operationId: string) {
  const admin = createAdminClient();
  const result = await admin
    .from("platform_billing_operations")
    .select("*")
    .eq("id", operationId)
    .single();
  if (result.error || !result.data) throw new Error("Operación no encontrada.");
  const op = result.data as Operation;
  if (op.applied_at || !["processing", "pending_payment"].includes(op.status))
    return;
  if (op.kind === "cancel" || op.kind === "resume") {
    const subscription = await stripe.subscriptions.retrieve(
      op.quote.subscriptionId,
    );
    if (subscription.schedule)
      await stripe.subscriptionSchedules.release(
        identifier(subscription.schedule)!,
        {},
        { idempotencyKey: `delunivo-release-${op.id}` },
      );
    await stripe.subscriptions.update(
      subscription.id,
      { cancel_at_period_end: op.kind === "cancel" },
      { idempotencyKey: `delunivo-cancel-${op.id}` },
    );
    const cleared = await admin
      .from("organization_billing")
      .update({
        scheduled_plan_key: null,
        scheduled_library_quantity: null,
        stripe_schedule_id: null,
      })
      .eq("organization_id", op.organization_id)
      .eq("platform_subscription_id", subscription.id);
    const done = await admin
      .from("platform_billing_operations")
      .update({
        status: "completed",
        applied_at: new Date().toISOString(),
        last_error: null,
        provider_id: subscription.id,
      })
      .eq("id", op.id);
    if (cleared.error || done.error)
      throw new Error("Cancellation recovery pending");
    return;
  }
  if (op.kind === "downgrade") {
    const subscription = await stripe.subscriptions.retrieve(
      op.quote.subscriptionId,
    );
    const scheduleId = identifier(subscription.schedule);
    const schedule = scheduleId
      ? await stripe.subscriptionSchedules.retrieve(scheduleId)
      : await stripe.subscriptionSchedules.create(
          { from_subscription: subscription.id },
          { idempotencyKey: `delunivo-schedule-${op.id}` },
        );
    if (schedule.metadata?.capacity_operation_id !== op.id) {
      if (schedule.metadata?.capacity_operation_id)
        throw new Error("Unrelated subscription schedule");
      if (op.provider_id !== schedule.id) {
        if (Date.now() - Date.parse(op.expires_at) + 15 * 60000 >= 23 * 3600000)
          throw new Error("Unknown schedule requires manual reconciliation");
        const original = await stripe.subscriptionSchedules.create(
          { from_subscription: subscription.id },
          { idempotencyKey: `delunivo-schedule-${op.id}` },
        );
        if (original.id !== schedule.id)
          throw new Error("Unrelated subscription schedule");
      }
      const bound = await admin
        .from("platform_billing_operations")
        .update({ provider_id: schedule.id })
        .eq("id", op.id);
      if (bound.error) throw new Error(bound.error.message);
      await stripe.subscriptionSchedules.update(
        schedule.id,
        { metadata: { capacity_operation_id: op.id } },
        { idempotencyKey: `delunivo-schedule-binding-${op.id}` },
      );
    }
    const next = await capacityPrice(op.quote.planKey),
      library = await capacityPrice("library");
    const complete = schedule.phases.some(
      (p) =>
        p.start_date === Math.floor(Date.parse(op.quote.cycleEnd) / 1000) &&
        p.items.some(
          (i) => identifier(i.price) === next.id && i.quantity === 1,
        ) &&
        (p.items.find((i) => identifier(i.price) === library.id)?.quantity ??
          0) === op.quote.libraryQuantity,
    );
    if (!complete) {
      if (Date.now() >= Date.parse(op.quote.cycleEnd) || !op.quote.currentItems)
        throw new Error("Scheduled change requires manual reconciliation");
      const discounts = (op.quote.discountIds ?? []).map((d) => ({
        discount: d,
      }));
      await stripe.subscriptionSchedules.update(
        schedule.id,
        {
          end_behavior: "release",
          phases: [
            {
              start_date: schedule.current_phase!.start_date,
              end_date: Math.floor(Date.parse(op.quote.cycleEnd) / 1000),
              items: op.quote.currentItems,
              discounts,
              default_tax_rates: op.quote.taxRates ?? [],
              proration_behavior: "none",
            },
            {
              items: [
                { price: next.id, quantity: 1 },
                ...(op.quote.libraryQuantity
                  ? [{ price: library.id, quantity: op.quote.libraryQuantity }]
                  : []),
              ],
              discounts,
              default_tax_rates: op.quote.taxRates ?? [],
              proration_behavior: "none",
              duration: { interval: "month", interval_count: 1 },
            },
          ],
        },
        { idempotencyKey: `delunivo-schedule-phases-${op.id}` },
      );
    }
    const saved = await admin
      .from("organization_billing")
      .update({
        scheduled_plan_key: op.quote.planKey,
        scheduled_library_quantity: op.quote.libraryQuantity,
        stripe_schedule_id: schedule.id,
      })
      .eq("organization_id", op.organization_id)
      .eq("platform_subscription_id", subscription.id);
    const done = await admin
      .from("platform_billing_operations")
      .update({
        status: "scheduled",
        provider_id: schedule.id,
        last_error: null,
      })
      .eq("id", op.id);
    if (saved.error || done.error) throw new Error("Schedule recovery pending");
    return;
  }
  if (op.kind !== "upgrade" && op.kind !== "library") return;
  const subscription = await stripe.subscriptions.retrieve(
    op.quote.subscriptionId,
  );
  const invoiceId =
    op.invoice_id ??
    (subscription.metadata.capacity_operation_id === op.id
      ? identifier(subscription.latest_invoice)
      : null);
  if (!invoiceId)
    throw new Error("Operación pendiente de conciliación de proveedor.");
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.status === "void") {
    await admin
      .from("platform_billing_operations")
      .update({ status: "expired", invoice_id: invoice.id })
      .eq("id", op.id);
    return;
  }
  if (invoice.status !== "paid" || subscription.pending_update) return;
  if (
    invoice.currency !== op.quote.currency ||
    invoice.amount_due !== op.quote.initialCents ||
    identifier(invoice.customer) !== identifier(subscription.customer)
  )
    throw new Error("Factura distinta de la previsualización aceptada.");
  const basePrice = await capacityPrice(op.quote.planKey);
  const item = subscription.items.data.find((i) => i.price.id === basePrice.id);
  if (
    !item ||
    iso(item.current_period_start) !== op.quote.cycleStart ||
    iso(item.current_period_end) !== op.quote.cycleEnd
  )
    throw new Error("Cambió el ciclo de la oferta. Requiere conciliación.");
  const saved = await admin.rpc("apply_platform_capacity_payment", {
    p_operation_id: op.id,
    p_subscription_id: subscription.id,
    p_cycle_start: op.quote.cycleStart,
    p_cycle_end: op.quote.cycleEnd,
    p_confirmed_at: iso(invoice.status_transitions.paid_at ?? invoice.created),
    p_source_id: invoice.id,
  });
  if (saved.error) throw new Error(saved.error.message);
}
