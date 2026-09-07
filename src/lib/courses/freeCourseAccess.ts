/**
 * Las decisiones de precio se hacen también en la base de datos, dentro del
 * RPC que concede el acceso. Esta comprobación es una defensa previa para no
 * abrir un Checkout de Stripe para un curso gratis ni tratar valores corruptos
 * (Infinity, NaN o una cadena vacía) como si costasen 0.
 */
export function parseFiniteCoursePrice(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

export function isFreeCoursePrice(value: unknown): boolean {
  return parseFiniteCoursePrice(value) === 0;
}

export function isPaidCoursePrice(value: unknown): boolean {
  const price = parseFiniteCoursePrice(value);
  return price !== null && price > 0;
}

export type FreeCourseGrantStatus =
  | "granted"
  | "already_has_access"
  | "price_changed"
  | "not_available"
  | "removed"
  | "revoked"
  | "account_inactive"
  | "checkout_pending";

export function freeCourseGrantMessage(status: FreeCourseGrantStatus): string {
  switch (status) {
    case "granted":
    case "already_has_access":
      return "";
    case "price_changed":
      return "El precio de este curso ha cambiado. Vuelve a la ficha para continuar.";
    case "not_available":
      return "Este curso gratuito ya no está disponible.";
    case "removed":
      return "Tu acceso a esta organización está desactivado.";
    case "revoked":
      return "Tu acceso a este curso fue revocado. Contacta con la organización si crees que es un error.";
    case "account_inactive":
      return "Tu cuenta no está activa para acceder a este curso.";
    case "checkout_pending":
      return "Hay un pago pendiente de confirmación para este curso. Espera unos minutos; no se te cobrará de nuevo.";
  }
}
