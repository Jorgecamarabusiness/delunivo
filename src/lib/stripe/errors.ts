/**
 * Traduce un error de Stripe a un mensaje que un dueño de empresa pueda
 * entender y accionar. Sin esto, el usuario veía el mensaje crudo de la API
 * (en inglés y hablando de "configurations" y "customers") o, peor, la pantalla
 * genérica de error de Next.
 */
export function describeStripeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  // El Billing Portal exige que exista una configuración guardada en el
  // dashboard antes de poder abrir ninguna sesión. Es el fallo más habitual la
  // primera vez que alguien pulsa "Gestionar suscripción".
  if (/no configuration provided/i.test(raw)) {
    return (
      "El portal de cliente de Stripe todavía no está configurado. " +
      "Actívalo una sola vez en Stripe → Configuración → Facturación → " +
      "Portal de cliente, y vuelve a intentarlo."
    );
  }

  if (/no such customer/i.test(raw)) {
    return (
      "El cliente de Stripe guardado no existe en esta cuenta. " +
      "Suele pasar al mezclar el modo de pruebas con el modo real: " +
      "vuelve a suscribirte para regenerarlo."
    );
  }

  if (/testmode|test mode/i.test(raw) && /live/i.test(raw)) {
    return (
      "Estás mezclando claves de modo de pruebas y de modo real en Stripe. " +
      "Revisa STRIPE_SECRET_KEY."
    );
  }

  if (/api key|authentication/i.test(raw)) {
    return "La clave de Stripe no es válida. Revisa STRIPE_SECRET_KEY.";
  }

  return `Stripe ha devuelto un error: ${raw}`;
}
