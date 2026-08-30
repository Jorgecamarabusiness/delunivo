import { defineConfig, devices } from "@playwright/test";

// En CI las variables llegan como Secrets de GitHub; en local se leen de
// estos dos archivos (ambos ignorados por git, ver .gitignore: ".env*").
for (const file of [".env.local", ".env.e2e.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // el archivo no existe (p. ej. en CI) — no pasa nada
  }
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // En CI, dos reporters: "github" pinta los fallos en la interfaz de Actions,
  // y "html" escribe playwright-report/ para poder subirlo como artefacto y
  // revisarlo después (con solo "github" no se generaba ningún archivo y el
  // paso de subida avisaba de que no encontraba nada).
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // `npm run build` completo entra justo en 180s en una máquina lenta o con
    // la caché fría; si expira, TODOS los tests fallan de golpe y parece un
    // problema del código.
    timeout: 300_000,
    env: {
      // Sin esto, cada corrida de la suite manda invitaciones de verdad a los
      // correos de `admin_emails`. Los tests comprueban el estado en base de
      // datos, no que Resend entregue.
      EMAIL_DELIVERY_MODE: "off",
      // Los tests verifican la cola en Postgres, pero nunca deben borrar
      // recursos reales de la cuenta de Mux enlazada al entorno local.
      MUX_DELETION_MODE: "off",
    },
  },
});
