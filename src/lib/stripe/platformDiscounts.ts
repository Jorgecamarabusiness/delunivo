import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { PLATFORM_NAME } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "./client";
import { createPlatformCoupon } from "./platformCoupons";
import {
  commercialTermsIdempotencyKey,
  subscriptionMatchesCommercialTerms,
} from "./subscriptionTerms";

type DiscountSnapshot = {
  effectivePercent: number;
  couponId: string | null;
  subscriptionId: string | null;
};

function stripeOperationKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function refreshOrganizationEffectiveDiscount(
  organizationId: string
): Promise<number> {
  const { data, error } = await createAdminClient().rpc(
    "refresh_organization_effective_discount",
    { p_organization_id: organizationId }
  );
  const percent = Number(data);
  if (error || !Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error(error?.message ?? "No se pudo calcular el descuento efectivo.");
  }
  return percent;
}

export async function ensureOrganizationDiscountCoupon(
  organizationId: string,
  options: { refresh?: boolean } = {}
): Promise<DiscountSnapshot> {
  const admin = createAdminClient();
  if (options.refresh !== false) {
    await refreshOrganizationEffectiveDiscount(organizationId);
  }

  const [{ data: billing, error: billingError }, { data: organization }] =
    await Promise.all([
      admin
        .from("organization_billing")
        .select(
          "effective_discount_percent, stripe_coupon_id, platform_subscription_id"
        )
        .eq("organization_id", organizationId)
        .single(),
      admin.from("organizations").select("name").eq("id", organizationId).single(),
    ]);

  if (billingError || !billing || !organization) {
    throw new Error("No se pudo cargar el descuento de la empresa.");
  }

  const effectivePercent = Number(billing.effective_discount_percent ?? 0);
  let couponId: string | null = null;

  if (effectivePercent > 0) {
    const coupon = await createPlatformCoupon({
      organizationId,
      organizationName: organization.name ?? PLATFORM_NAME,
      percentOff: effectivePercent,
      duration: "forever",
    });
    couponId = coupon.id;
  }

  if (billing.stripe_coupon_id !== couponId) {
    const { error } = await admin
      .from("organization_billing")
      .update({ stripe_coupon_id: couponId, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    if (error) throw new Error("No se pudo guardar el cupón efectivo.");
  }

  return {
    effectivePercent,
    couponId,
    subscriptionId: billing.platform_subscription_id,
  };
}

export async function syncOrganizationDiscountToStripe(
  organizationId: string,
  operationId: string
): Promise<void> {
  const snapshot = await ensureOrganizationDiscountCoupon(organizationId, {
    refresh: false,
  });
  if (!snapshot.subscriptionId) return;

  await stripe.subscriptions.update(
    snapshot.subscriptionId,
    { discounts: snapshot.couponId ? [{ coupon: snapshot.couponId }] : [] },
    {
      idempotencyKey: `delunivo-discount-${stripeOperationKey(
        `${operationId}:${organizationId}:${snapshot.effectivePercent}`
      )}`,
    }
  );
}

/**
 * Converge la suscripción hacia la última versión ganadora de las condiciones
 * comerciales. Se usa cuando una escritura optimista pierde una carrera: no
 * intenta rescatar la versión perdedora, sino aplicar a Stripe la que quedó en
 * Postgres. Si vuelve a cambiar mientras sincroniza, relee y reintenta.
 */
export async function reconcileOrganizationCommercialTermsToStripe(
  organizationId: string
): Promise<void> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [{ data: billing, error: billingError }, { data: organization }] =
      await Promise.all([
        admin
          .from("organization_billing")
          .select(
            "platform_subscription_id, access_mode, access_expires_at, effective_discount_percent, stripe_coupon_id, updated_at"
          )
          .eq("organization_id", organizationId)
          .single(),
        admin.from("organizations").select("name").eq("id", organizationId).single(),
      ]);
    if (billingError || !billing || !organization) {
      throw new Error("No se pudieron releer las condiciones ganadoras.");
    }

    const percent =
      billing.access_mode === "complimentary"
        ? 100
        : Number(billing.effective_discount_percent ?? 0);
    const couponId =
      percent > 0
        ? (
            await createPlatformCoupon({
              organizationId,
              organizationName: organization.name ?? PLATFORM_NAME,
              percentOff: percent,
              duration: "forever",
            })
          ).id
        : null;

    let snapshotVersion = billing.updated_at;
    if (billing.stripe_coupon_id !== couponId) {
      snapshotVersion = new Date().toISOString();
      const { data: saved, error: saveError } = await admin
        .from("organization_billing")
        .update({ stripe_coupon_id: couponId, updated_at: snapshotVersion })
        .eq("organization_id", organizationId)
        .eq("updated_at", billing.updated_at)
        .select("organization_id")
        .maybeSingle();
      if (saveError) throw new Error(saveError.message);
      if (!saved) continue;
    }

    if (billing.platform_subscription_id) {
      const currentSubscription = await stripe.subscriptions.retrieve(
        billing.platform_subscription_id,
        { expand: ["discounts.source.coupon"] }
      );
      const trialEndsAt =
        billing.access_mode === "trial" && billing.access_expires_at
          ? new Date(billing.access_expires_at)
          : null;
      const expectedTerms = {
        couponId,
        trialEndsAt,
        shouldEndCurrentTrial:
          billing.access_mode !== "trial" &&
          currentSubscription.status === "trialing",
      };
      const update: Stripe.SubscriptionUpdateParams = {
        discounts: couponId ? [{ coupon: couponId }] : [],
        expand: ["discounts.source.coupon"],
      };
      if (trialEndsAt) {
        update.trial_end = Math.floor(trialEndsAt.getTime() / 1000);
      } else if (expectedTerms.shouldEndCurrentTrial) {
        update.trial_end = "now";
      }
      const reconciled = await stripe.subscriptions.update(
        billing.platform_subscription_id,
        update,
        {
          idempotencyKey: commercialTermsIdempotencyKey(
            billing.platform_subscription_id,
            expectedTerms
          ),
        }
      );
      if (!subscriptionMatchesCommercialTerms(reconciled, expectedTerms)) {
        throw new Error("Stripe no confirmó las condiciones ganadoras.");
      }
    }

    const { data: latest } = await admin
      .from("organization_billing")
      .select("updated_at")
      .eq("organization_id", organizationId)
      .single();
    if (latest?.updated_at === snapshotVersion) return;
  }

  throw new Error("Las condiciones siguieron cambiando durante la reconciliación.");
}
