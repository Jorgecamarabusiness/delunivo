export const SELLER_LEGAL_LIMITS = {
  legalName: 160,
  taxId: 80,
  address: 500,
  contactEmail: 254,
  country: 100,
} as const;

export type SellerLegalInfo = {
  seller_legal_name: string | null;
  seller_tax_id: string | null;
  seller_address: string | null;
  seller_contact_email: string | null;
  seller_country: string | null;
};

export type SellerLegalInput = {
  legalName: string;
  taxId: string;
  address: string;
  contactEmail: string;
  country: string;
};

export type SellerLegalValidation =
  | { ok: true; value: SellerLegalInfo }
  | { ok: false; error: string };

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function exceeds(value: string | null, limit: number): boolean {
  return value !== null && value.length > limit;
}

/**
 * Estos campos identifican públicamente al vendedor del curso. No impone un
 * formato nacional de identificador fiscal: las escuelas pueden operar fuera
 * de España. La exigencia material de completarlos pertenece a la publicación
 * y a la revisión legal, no a esta normalización técnica.
 */
export function validateSellerLegalInput(
  input: SellerLegalInput
): SellerLegalValidation {
  const value: SellerLegalInfo = {
    seller_legal_name: optionalValue(input.legalName),
    seller_tax_id: optionalValue(input.taxId),
    seller_address: optionalValue(input.address),
    seller_contact_email: optionalValue(input.contactEmail),
    seller_country: optionalValue(input.country),
  };

  if (exceeds(value.seller_legal_name, SELLER_LEGAL_LIMITS.legalName)) {
    return { ok: false, error: "El nombre legal no puede superar 160 caracteres." };
  }
  if (exceeds(value.seller_tax_id, SELLER_LEGAL_LIMITS.taxId)) {
    return { ok: false, error: "El identificador fiscal no puede superar 80 caracteres." };
  }
  if (exceeds(value.seller_address, SELLER_LEGAL_LIMITS.address)) {
    return { ok: false, error: "El domicilio no puede superar 500 caracteres." };
  }
  if (exceeds(value.seller_contact_email, SELLER_LEGAL_LIMITS.contactEmail)) {
    return { ok: false, error: "El correo de contacto no puede superar 254 caracteres." };
  }
  if (exceeds(value.seller_country, SELLER_LEGAL_LIMITS.country)) {
    return { ok: false, error: "El país o territorio no puede superar 100 caracteres." };
  }
  if (
    value.seller_contact_email !== null &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.seller_contact_email)
  ) {
    return { ok: false, error: "Introduce un correo de contacto válido." };
  }

  return { ok: true, value };
}

export function sellerLegalMissingFields(info: SellerLegalInfo): string[] {
  const missing: string[] = [];
  if (!info.seller_legal_name) missing.push("nombre legal");
  if (!info.seller_tax_id) missing.push("identificador fiscal");
  if (!info.seller_address) missing.push("domicilio");
  if (!info.seller_contact_email) missing.push("correo de contacto");
  return missing;
}

export function hasCompleteSellerLegalInfo(info: SellerLegalInfo): boolean {
  return sellerLegalMissingFields(info).length === 0;
}

export function sellerDisplayName(
  info: SellerLegalInfo,
  organizationName: string
): string {
  return info.seller_legal_name ?? organizationName;
}
