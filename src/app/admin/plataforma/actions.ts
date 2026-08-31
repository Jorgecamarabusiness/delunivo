"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import type {
  CommercialAccessMode,
  DiscountDuration,
} from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { describeStripeError } from "@/lib/stripe/errors";
import { createPlatformCoupon } from "@/lib/stripe/platformCoupons";
import { reconcileOrganizationCommercialTermsToStripe } from "@/lib/stripe/platformDiscounts";
import {
  commercialTermsIdempotencyKey,
  subscriptionMatchesCommercialTerms,
} from "@/lib/stripe/subscriptionTerms";
import type { ActionResult } from "@/types";

async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await requireSuperAdmin(supabase);
  return { error, user };
}

export async function updatePlatformPriceAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "No autorizado." };

  const euros = Number(String(formData.get("monthlyPrice") ?? "").replace(",", "."));
  const cents = Math.round(euros * 100);
  if (!Number.isFinite(cents) || cents < 100 || cents > 1_000_000) {
    return { error: "El precio debe estar entre 1 € y 10.000 €." };
  }

  const { data, error } = await createAdminClient()
    .from("platform_settings")
    .update({
      monthly_price_cents: cents,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("id", true)
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se encontró la configuración." };
  }

  revalidatePath("/");
  revalidatePath("/crear-empresa");
  revalidatePath("/admin/facturacion");
  revalidatePath("/admin/plataforma");
  return { error: null };
}

function parseAccessMode(value: FormDataEntryValue | null): CommercialAccessMode | null {
  return value === "standard" || value === "complimentary" || value === "trial"
    ? value
    : null;
}

function parseDiscountDuration(
  value: FormDataEntryValue | null
): DiscountDuration {
  return value === "forever" ? "forever" : "once";
}

function parseExpiry(value: FormDataEntryValue | null) {
  const date = String(value ?? "").trim();
  if (!date) return null;
  const expiry = new Date(`${date}T23:59:59.999Z`);
  return Number.isFinite(expiry.getTime()) ? expiry : null;
}

export async function updateOrganizationCommercialTermsAction(
  organizationId: string,
  formData: FormData
): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error ?? "No autorizado." };

  const accessMode = parseAccessMode(formData.get("accessMode"));
  const expiry = parseExpiry(formData.get("accessExpiresOn"));
  const discountPercent = Number(formData.get("discountPercent") ?? 0);
  const affiliateDiscountCapPercent = Number(
    formData.get("affiliateDiscountCapPercent") ?? 50
  );
  const discountDuration = parseDiscountDuration(formData.get("discountDuration"));
  const commercialNote = String(formData.get("commercialNote") ?? "").trim();
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "");

  if (!accessMode) return { error: "Selecciona un tipo de acceso válido." };
  if (accessMode === "trial" && (!expiry || expiry.getTime() <= Date.now())) {
    return { error: "La prueba gratuita debe terminar en una fecha futura." };
  }
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    return { error: "El descuento debe ser un porcentaje entero entre 0 y 100." };
  }
  if (
    !Number.isInteger(affiliateDiscountCapPercent) ||
    affiliateDiscountCapPercent < 0 ||
    affiliateDiscountCapPercent > 100
  ) {
    return { error: "El tope total debe ser un porcentaje entre 0 y 100." };
  }
  if (commercialNote.length > 1000) {
    return { error: "La nota no puede superar los 1.000 caracteres." };
  }

  const admin = createAdminClient();
  const [organizationResult, billingResult] = await Promise.all([
    admin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    admin
      .from("organization_billing")
      .select(
        "platform_subscription_id, platform_subscription_status, access_mode, access_expires_at, discount_percent, discount_duration, stripe_coupon_id, commercial_note, affiliate_discount_cap_percent, effective_discount_percent, manual_discount_remaining_payments, updated_at"
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const organization = organizationResult.data;
  const current = billingResult.data;

  if (
    organizationResult.error ||
    billingResult.error ||
    !organization ||
    !current
  ) {
    return { error: "No se pudo cargar la configuración comercial de la empresa." };
  }
  if (!expectedUpdatedAt || current.updated_at !== expectedUpdatedAt) {
    return {
      error:
        "Otra persona ha actualizado esta empresa. Recarga la página antes de volver a guardar.",
    };
  }

  const manualDiscountUnchanged =
    current.discount_percent === discountPercent &&
    current.discount_duration === discountDuration;
  const manualDiscountRemainingPayments =
    accessMode === "complimentary"
      ? 0
      : manualDiscountUnchanged
        ? current.manual_discount_remaining_payments
        : discountDuration === "once" && discountPercent > 0
          ? 1
          : 0;

  const platformStatus =
    accessMode === "standard" && !current.platform_subscription_id
      ? "canceled"
      : current.platform_subscription_status;
  const nextUpdatedAt = new Date().toISOString();
  const nextBilling = {
    platform_subscription_status: platformStatus,
    access_mode: accessMode,
    access_expires_at: accessMode === "trial" ? expiry!.toISOString() : null,
    discount_percent: accessMode === "complimentary" ? 0 : discountPercent,
    discount_duration: discountDuration,
    affiliate_discount_cap_percent: affiliateDiscountCapPercent,
    manual_discount_remaining_payments: manualDiscountRemainingPayments,
    stripe_coupon_id: current.stripe_coupon_id,
    commercial_note: commercialNote || null,
    updated_at: nextUpdatedAt,
  };
  const { data: updatedBilling, error } = await admin
    .from("organization_billing")
    .update(nextBilling)
    .eq("organization_id", organizationId)
    .eq("updated_at", expectedUpdatedAt)
    .select("organization_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!updatedBilling) {
    return {
      error:
        "Otra persona ha actualizado esta empresa. Recarga la página antes de volver a guardar.",
    };
  }

  const { error: refreshError } = await admin.rpc(
    "refresh_organization_effective_discount",
    { p_organization_id: organizationId }
  );
  if (refreshError) {
    await admin
      .from("organization_billing")
      .update({
        platform_subscription_status: current.platform_subscription_status,
        access_mode: current.access_mode,
        access_expires_at: current.access_expires_at,
        discount_percent: current.discount_percent,
        discount_duration: current.discount_duration,
        affiliate_discount_cap_percent: current.affiliate_discount_cap_percent,
        effective_discount_percent: current.effective_discount_percent,
        manual_discount_remaining_payments:
          current.manual_discount_remaining_payments,
        stripe_coupon_id: current.stripe_coupon_id,
        commercial_note: current.commercial_note,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("updated_at", nextUpdatedAt);
    return { error: refreshError.message };
  }

  const { data: refreshed, error: refreshedError } = await admin
    .from("organization_billing")
    .select("effective_discount_percent, updated_at")
    .eq("organization_id", organizationId)
    .single();
  if (refreshedError || !refreshed) {
    return { error: "No se pudo confirmar el descuento efectivo." };
  }

  const stripeDiscountPercent =
    accessMode === "complimentary" ? 100 : refreshed.effective_discount_percent;
  let couponId: string | null = null;
  if (stripeDiscountPercent > 0) {
    try {
      const coupon = await createPlatformCoupon({
        organizationId,
        organizationName: organization.name,
        percentOff: stripeDiscountPercent,
        duration: "forever",
      });
      couponId = coupon.id;
    } catch (stripeError) {
      await admin
        .from("organization_billing")
        .update({
          platform_subscription_status: current.platform_subscription_status,
          access_mode: current.access_mode,
          access_expires_at: current.access_expires_at,
          discount_percent: current.discount_percent,
          discount_duration: current.discount_duration,
          affiliate_discount_cap_percent: current.affiliate_discount_cap_percent,
          effective_discount_percent: current.effective_discount_percent,
          manual_discount_remaining_payments:
            current.manual_discount_remaining_payments,
          stripe_coupon_id: current.stripe_coupon_id,
          commercial_note: current.commercial_note,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("updated_at", refreshed.updated_at);
      return { error: describeStripeError(stripeError) };
    }
  }

  const couponUpdatedAt = new Date().toISOString();
  const { data: couponSaved, error: couponSaveError } = await admin
    .from("organization_billing")
    .update({ stripe_coupon_id: couponId, updated_at: couponUpdatedAt })
    .eq("organization_id", organizationId)
    .eq("updated_at", refreshed.updated_at)
    .select("organization_id")
    .maybeSingle();
  if (couponSaveError || !couponSaved) {
    try {
      await reconcileOrganizationCommercialTermsToStripe(organizationId);
    } catch (reconciliationError) {
      console.error(
        "No se pudieron reconciliar las condiciones comerciales ganadoras.",
        reconciliationError
      );
      return {
        error:
          "La empresa cambió mientras se preparaba el descuento y no se pudo confirmar la sincronización con Stripe. Revisa la suscripción antes de continuar.",
      };
    }
    return {
      error:
        couponSaveError?.message ??
        "La empresa cambió mientras se preparaba el descuento. Se ha sincronizado la versión ganadora; recarga la página.",
    };
  }

  if (current.platform_subscription_id) {
    const expectedTerms = {
      couponId,
      trialEndsAt: accessMode === "trial" ? expiry : null,
      shouldEndCurrentTrial:
        accessMode !== "trial" && current.access_mode === "trial",
    };
    const update: Stripe.SubscriptionUpdateParams = {
      discounts: couponId ? [{ coupon: couponId }] : [],
      expand: ["discounts.source.coupon"],
    };
    if (expectedTerms.trialEndsAt) {
      update.trial_end = Math.floor(expectedTerms.trialEndsAt.getTime() / 1000);
    } else if (expectedTerms.shouldEndCurrentTrial) {
      update.trial_end = "now";
    }

    let stripeError: unknown = null;
    try {
      const subscription = await stripe.subscriptions.update(
        current.platform_subscription_id,
        update,
        {
          idempotencyKey: commercialTermsIdempotencyKey(
            current.platform_subscription_id,
            expectedTerms
          ),
        }
      );
      if (!subscriptionMatchesCommercialTerms(subscription, expectedTerms)) {
        stripeError = new Error(
          "Stripe no devolvió las condiciones comerciales esperadas."
        );
      }
    } catch (error) {
      stripeError = error;
    }

    if (stripeError) {
      try {
        const recoveredSubscription = await stripe.subscriptions.retrieve(
          current.platform_subscription_id,
          { expand: ["discounts.source.coupon"] }
        );
        if (
          subscriptionMatchesCommercialTerms(
            recoveredSubscription,
            expectedTerms
          )
        ) {
          stripeError = null;
        }
      } catch (verificationError) {
        console.error(
          "No se pudo confirmar el estado de Stripe tras actualizar condiciones comerciales.",
          verificationError
        );
        return {
          error:
            "Stripe no respondió y no se pudo confirmar el resultado. Las condiciones no se han revertido para evitar sobrescribir un cambio que pudiera haberse aplicado. Revisa esta empresa antes de volver a guardar.",
        };
      }
    }

    if (stripeError) {
      const { data: rolledBack, error: rollbackError } = await admin
        .from("organization_billing")
        .update({
          platform_subscription_status: current.platform_subscription_status,
          access_mode: current.access_mode,
          access_expires_at: current.access_expires_at,
          discount_percent: current.discount_percent,
          discount_duration: current.discount_duration,
          affiliate_discount_cap_percent:
            current.affiliate_discount_cap_percent,
          effective_discount_percent: current.effective_discount_percent,
          manual_discount_remaining_payments:
            current.manual_discount_remaining_payments,
          stripe_coupon_id: current.stripe_coupon_id,
          commercial_note: current.commercial_note,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("updated_at", couponUpdatedAt)
        .select("organization_id")
        .maybeSingle();

      if (rollbackError || !rolledBack) {
        return {
          error:
            "Stripe rechazó el cambio, pero otra actualización ya había avanzado. No se ha sobrescrito: recarga y revisa esta empresa antes de continuar.",
        };
      }
      return { error: describeStripeError(stripeError) };
    }
  }

  revalidatePath("/admin/plataforma");
  revalidatePath("/admin/facturacion");
  revalidatePath("/admin");
  return { error: null };
}
