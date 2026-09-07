/**
 * Refuse real services before Playwright or a seed can perform any writes.
 * @param {Record<string, string | undefined>} env
 */
export function assertIsolatedE2EEnvironment(env = process.env) {
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    throw new Error("E2E bloqueado: falta una URL de Supabase local válida.");
  }
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("E2E bloqueado: las pruebas con escritura solo admiten Supabase en loopback, nunca cloud/producción.");
  }
  if (env.E2E_DATA_POLICY !== "synthetic-only") {
    throw new Error("E2E bloqueado: verifica el contenido de la base aislada y define E2E_DATA_POLICY=synthetic-only.");
  }
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    throw new Error("E2E bloqueado: Stripe debe usar una clave de prueba.");
  }
  if (Object.entries(env).some(([name, value]) => name.startsWith("MUX_") && name !== "MUX_DELETION_MODE" && value) || env.RESEND_API_KEY) {
    throw new Error("E2E bloqueado: retira las credenciales de Mux y Resend del entorno de pruebas.");
  }
}
