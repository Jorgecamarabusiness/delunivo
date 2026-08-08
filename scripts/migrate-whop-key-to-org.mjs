// Migra la clave global de Whop (WHOP_API_KEY / WHOP_PRODUCT_ID en .env.local)
// a la fila cifrada de organization_integrations de la organización indicada,
// para que el flujo de redención de Whop (Fase 5, por organización) siga
// funcionando para el cliente que ya la usaba antes de la migración.
// Idempotente: si ya existe una fila para esa organización, la actualiza.
//
// Uso: node --env-file=.env.local scripts/migrate-whop-key-to-org.mjs <org-slug>

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_PRODUCT_ID = process.env.WHOP_PRODUCT_ID;

const orgSlug = process.argv[2];

if (!orgSlug) {
  console.error("Uso: node --env-file=.env.local scripts/migrate-whop-key-to-org.mjs <org-slug>");
  process.exit(1);
}

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  ENCRYPTION_KEY,
  WHOP_API_KEY,
  WHOP_PRODUCT_ID,
})) {
  if (!value) {
    console.error(`Falta ${name}. Ejecuta con --env-file=.env.local`);
    process.exit(1);
  }
}

function encrypt(plaintext) {
  const key = Buffer.from(ENCRYPTION_KEY, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) {
    console.error(`No existe ninguna organización con slug "${orgSlug}".`);
    process.exit(1);
  }

  const { error } = await admin.from("organization_integrations").upsert(
    {
      organization_id: org.id,
      whop_api_key_encrypted: encrypt(WHOP_API_KEY),
      whop_product_id: WHOP_PRODUCT_ID,
    },
    { onConflict: "organization_id" }
  );

  if (error) throw error;

  console.log(`Clave de Whop migrada a "${org.name}" (${orgSlug}), cifrada con ENCRYPTION_KEY.`);
  console.log("Ojo: WHOP_API_KEY / WHOP_PRODUCT_ID en .env.local SIGUEN en uso por src/app/api/webhooks/whop/route.ts (el email de aviso de la license key, todavía de un solo tenant) — no las borres.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
