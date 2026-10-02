/** Immutable commercial offer. All public copy and server prices use this file. */
export const OFFER_VERSION = "2026-10-01";
export const PILOT_TAX_POLICY = {
  version: `${OFFER_VERSION}-es-peninsula-baleares`,
  country: "ES", scope: "peninsula-baleares", percentage: 21, inclusive: true,
} as const;
export const RETENTION_POLICY_VERSION = "2026-10-01";
export const PLANS = [
  {
    key: "inicio",
    name: "Inicio",
    priceCents: 3000,
    libraryHours: 20,
    deliveryMinutes: 3000,
    graceMinutes: 300,
    audience: "Para comenzar tu escuela",
  },
  {
    key: "crece",
    name: "Crece",
    priceCents: 6900,
    libraryHours: 50,
    deliveryMinutes: 8000,
    graceMinutes: 800,
    audience: "Para una escuela en crecimiento",
  },
  {
    key: "academia",
    name: "Academia",
    priceCents: 14900,
    libraryHours: 100,
    deliveryMinutes: 20000,
    graceMinutes: 2000,
    audience: "Para academias con una biblioteca amplia",
  },
] as const;
export type PlanKey = (typeof PLANS)[number]["key"];
export const LIBRARY_EXTENSION = {
  priceCents: 800,
  hours: 10,
  economicHours: 12,
} as const;
export const DELIVERY_PACK = {
  priceCents: 2000,
  minutes: 5000,
  validityDays: 90,
} as const;
export const TRIAL = {
  days: 14,
  libraryHours: 2,
  economicHours: 2.4,
  deliveryMinutes: 300,
  graceMinutes: 0,
} as const;

export function getPlan(key: unknown) {
  return PLANS.find((plan) => plan.key === key) ?? null;
}

export function offerSnapshot(key: PlanKey, discountPercent = 0) {
  const plan = getPlan(key)!;
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  )
    throw new Error("Descuento inválido.");
  return {
    version: OFFER_VERSION,
    planKey: key,
    name: plan.name,
    priceCents: plan.priceCents,
    currency: "eur",
    taxBehavior: "inclusive",
    taxPolicy: PILOT_TAX_POLICY,
    interval: "month",
    discountPercent,
    librarySeconds: plan.libraryHours * 3600,
    economicSeconds: plan.libraryHours * 4320,
    deliverySeconds: plan.deliveryMinutes * 60,
    graceSeconds: plan.graceMinutes * 60,
    libraryExtension: LIBRARY_EXTENSION,
    deliveryPack: DELIVERY_PACK,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
    retentionDays: 30,
    libraryExcessGraceDays: 7,
    courseCommissionPercent: 0,
    unlimitedCourses: true,
    unlimitedRegisteredStudents: true,
    maxVideoResolution: "1080p",
    automaticOverageCharges: false,
  };
}

export function trialOfferSnapshot() {
  return {
    ...offerSnapshot("inicio"),
    planKey: "trial",
    name: "Prueba",
    priceCents: 0,
    librarySeconds: 7200,
    economicSeconds: 8640,
    deliverySeconds: 18000,
    graceSeconds: 0,
    interval: "trial",
    trialDays: 14,
    automaticRenewal: false,
  };
}

/** Floor to whole seconds; never grant more than the exact proportional increase. */
export function proratedSeconds(
  delta: number,
  start: number,
  end: number,
  at: number,
) {
  if (
    ![delta, start, end, at].every(Number.isSafeInteger) ||
    delta < 0 ||
    end <= start
  )
    throw new Error("Intervalo de prorrateo inválido.");
  const remaining = BigInt(Math.max(0, Math.min(end - start, end - at)));
  return Number((BigInt(delta) * remaining) / BigInt(end - start));
}
