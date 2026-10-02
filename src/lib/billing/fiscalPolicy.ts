import { OFFER_VERSION, PILOT_TAX_POLICY } from "./catalog.ts";

export const FISCAL_POLICY_VERSION = PILOT_TAX_POLICY.version;
export type FiscalDomicile = {
  name: string;
  address: { line1: string; city: string; postal_code: string; country: "ES" };
};

export function fiscalPolicyRequired() {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") ||
    process.env.PLATFORM_TAX_LIVE_APPROVED === OFFER_VERSION;
}

export function isPilotPostalCode(value: unknown) {
  if (typeof value !== "string" || !/^\d{5}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  return province >= 1 && province <= 50 && province !== 35 && province !== 38;
}

const requiredText = (value: unknown, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("Completa correctamente el nombre y el domicilio fiscal.");
  return value.trim();
};

export function validateFiscalDomicile(input: {
  name?: unknown; line1?: unknown; city?: unknown; postalCode?: unknown;
  country?: unknown; accepted?: unknown;
}): FiscalDomicile {
  if (input.accepted !== "yes")
    throw new Error("Confirma que el domicilio fiscal de la escuela está en Península o Baleares.");
  if (input.country !== "ES" || !isPilotPostalCode(input.postalCode))
    throw new Error("Este piloto admite domicilios fiscales de España, solo Península y Baleares, con IVA del 21 % incluido.");
  return { name: requiredText(input.name, 200), address: {
    line1: requiredText(input.line1, 200), city: requiredText(input.city, 100),
    postal_code: input.postalCode as string, country: "ES",
  } };
}

type FiscalCustomer = {
  deleted?: boolean | void; name?: string | null; tax_exempt?: string | null;
  address?: { country?: string | null; postal_code?: string | null; line1?: string | null; city?: string | null } | null;
  metadata?: Record<string, string>;
};
export function assertFiscalCustomer(customer: FiscalCustomer, organizationId: string) {
  if (customer.deleted || customer.metadata?.organization_id !== organizationId ||
    customer.metadata?.fiscal_policy_version !== FISCAL_POLICY_VERSION ||
    customer.tax_exempt !== "none" || customer.address?.country !== "ES" ||
    !isPilotPostalCode(customer.address?.postal_code) || !customer.name?.trim() ||
    !customer.address?.line1?.trim() || !customer.address?.city?.trim())
    throw new Error("El domicilio fiscal requiere confirmación antes de abrir o cambiar el pago. Este piloto admite solo Península y Baleares.");
}

export function assertPilotTaxRate(rate: {
  active: boolean; inclusive: boolean; percentage: number; country: string | null;
  tax_type?: string | null;
}) {
  if (!rate.active || !rate.inclusive || rate.percentage !== PILOT_TAX_POLICY.percentage || rate.country !== PILOT_TAX_POLICY.country ||
    (rate.tax_type != null && rate.tax_type !== "vat"))
    throw new Error("La tarifa del piloto debe ser IVA español del 21 %, activo e incluido en el precio.");
}
