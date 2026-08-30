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
  const discountDuration = parseDiscountDuration(formData.get("discountDuration"));
  const commercialNote = String(formData.get("commercialNote") ?? "").trim();

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
  if (commercialNote.length > 1000) {
    return { error: "La nota no puede superar los 1.000 caracteres." };
  }

  const admin = createAdminClient();
  const [organizationResult, billingResult] = await Promise.all([
    admin.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    admin
      .from("organization_billing")
      .select(
        "platform_subscription_id, platform_subscription_status, access_mode, access_expires_at, discount_percent, discount_duration, stripe_coupon_id, commercial_note"
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

  const stripeDiscountPercent = accessMode === "complimentary" ? 100 : discountPercent;
  const stripeDiscountDuration: DiscountDuration =
    accessMode === "complimentary" ? "forever" : discountDuration;
  const discountUnchanged =
    current.access_mode === accessMode &&
    current.discount_percent === discountPercent &&
    current.discount_duration === discountDuration;
  let couponId =
    stripeDiscountPercent > 0 && discountUnchanged ? current.stripe_coupon_id : null;

  if (current.platform_subscription_id && stripeDiscountPercent > 0 && !couponId) {
    try {
      const coupon = await createPlatformCoupon({
        organizationId,
        organizationName: organization.name,
        percentOff: stripeDiscountPercent,
        duration: stripeDiscountDuration,
      });
      couponId = coupon.id;
    } catch (stripeError) {
      return { error: describeStripeError(stripeError) };
    }
  }

  const platformStatus =
    accessMode === "standard" && !current.platform_subscription_id
      ? "canceled"
      : current.platform_subscription_status;
  const nextBilling = {
    platform_subscription_status: platformStatus,
    access_mode: accessMode,
    access_expires_at: accessMode === "trial" ? expiry!.toISOString() : null,
    discount_percent: accessMode === "complimentary" ? 0 : discountPercent,
    discount_duration: discountDuration,
    stripe_coupon_id: couponId,
    commercial_note: commercialNote || null,
    updated_at: new Date().toISOString(),
  };
  const { data: updatedBilling, error } = await admin
    .from("organization_billing")
    .update(nextBilling)
    .eq("organization_id", organizationId)
    .select("organization_id")
    .single();

  if (error || !updatedBilling) {
    return { error: error?.message ?? "No se guardaron las condiciones." };
  }

  try {
    if (current.platform_subscription_id) {
      const update: Stripe.SubscriptionUpdateParams = {
        discounts: couponId ? [{ coupon: couponId }] : [],
      };

      if (accessMode === "trial" && expiry) {
        update.trial_end = Math.floor(expiry.getTime() / 1000);
      } else if (current.access_mode === "trial") {
        const subscription = await stripe.subscriptions.retrieve(
          current.platform_subscription_id
        );
        if (subscription.status === "trialing") update.trial_end = "now";
      }

      await stripe.subscriptions.update(current.platform_subscription_id, update);
    }
  } catch (stripeError) {
    const { error: rollbackError } = await admin
      .from("organization_billing")
      .update({
        platform_subscription_status: current.platform_subscription_status,
        access_mode: current.access_mode,
        access_expires_at: current.access_expires_at,
        discount_percent: current.discount_percent,
        discount_duration: current.discount_duration,
        stripe_coupon_id: current.stripe_coupon_id,
        commercial_note: current.commercial_note,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);

    if (rollbackError) {
      return {
        error:
          "Stripe rechazó el cambio y no se pudo restaurar el estado anterior. Revisa esta empresa manualmente antes de continuar.",
      };
    }
    return { error: describeStripeError(stripeError) };
  }

  revalidatePath("/admin/plataforma");
  revalidatePath("/admin/facturacion");
  revalidatePath("/admin");
  return { error: null };
}
