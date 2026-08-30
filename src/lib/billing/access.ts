export const DEFAULT_PLATFORM_PRICE_CENTS = 3000;

export type PlatformBillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type CommercialAccessMode = "standard" | "complimentary" | "trial";
export type DiscountDuration = "once" | "forever";

export type BillingAccessState = {
  platformSubscriptionStatus: PlatformBillingStatus | null;
  accessMode?: CommercialAccessMode | null;
  accessExpiresAt?: string | null;
};

export function isFutureDate(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function hasComplimentaryAccess(
  state: BillingAccessState,
  now = new Date()
) {
  return (
    state.accessMode === "complimentary" &&
    (!state.accessExpiresAt || isFutureDate(state.accessExpiresAt, now))
  );
}

export function resolveEffectiveBillingStatus(
  state: BillingAccessState,
  now = new Date()
): PlatformBillingStatus | null {
  if (hasComplimentaryAccess(state, now)) return "active";
  if (state.accessMode === "trial" && isFutureDate(state.accessExpiresAt, now)) {
    return "trialing";
  }
  return state.platformSubscriptionStatus;
}

export function formatPlatformPrice(priceCents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(priceCents / 100);
}
