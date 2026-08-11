/**
 * La plataforma cobra en euros (la suscripción son 20€/mes y los checkouts de
 * Stripe usan `eur`), pero los precios se pintaban con "$" a mano en tres
 * páginas distintas. Un único sitio, y con el formato español.
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    // Los precios enteros (49 €) se ven mejor sin ",00"; los que tienen
    // decimales (9,99 €) los conservan.
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}
