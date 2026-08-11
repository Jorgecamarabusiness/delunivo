import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type VerificationPurpose = "signup" | "password_reset";

/** Minutos que vive un código antes de caducar. */
export const CODE_TTL_MINUTES = 30;

/** Intentos fallidos permitidos antes de invalidar el código. */
const MAX_ATTEMPTS = 5;

/**
 * Topes de EMISIÓN de códigos. Cada código emitido es un email enviado, así que
 * sin límite cualquiera puede (a) quemar la cuota de Resend pulsando "enviar
 * otro código", y (b) bombardear el buzón de una persona real metiendo su
 * correo en /forgot-password una y otra vez. El tope de intentos de más arriba
 * no cubre nada de esto: protege el código ya emitido, no su emisión.
 *
 * Se cuentan filas de `verification_codes` por `created_at`, sin tabla nueva.
 */
const RATE_WINDOW_MINUTES = 15;
/** Por correo: 3 en 15 min da margen a "no me ha llegado" sin permitir spam. */
const MAX_CODES_PER_EMAIL = 3;
/**
 * Global: techo de seguridad contra un atacante que use muchos correos
 * distintos. Muy por encima del tráfico legítimo de esta plataforma; si algún
 * día se queda corto, se sube aquí.
 */
const MAX_CODES_GLOBAL = 60;

export type IssueRateLimit = { limited: true; error: string } | { limited: false };

async function checkIssueRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  normalizedEmail: string
): Promise<IssueRateLimit> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();

  const [{ count: perEmail }, { count: global }] = await Promise.all([
    admin
      .from("verification_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .gte("created_at", since),
    admin
      .from("verification_codes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  if ((perEmail ?? 0) >= MAX_CODES_PER_EMAIL) {
    return {
      limited: true,
      error: `Has pedido demasiados códigos seguidos. Espera ${RATE_WINDOW_MINUTES} minutos y vuelve a intentarlo.`,
    };
  }

  if ((global ?? 0) >= MAX_CODES_GLOBAL) {
    return {
      limited: true,
      error: "Ahora mismo no podemos enviar más códigos. Inténtalo en unos minutos.",
    };
  }

  return { limited: false };
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * 6 dígitos con `randomInt` (criptográficamente seguro), no con `Math.random`.
 * Se rellena con ceros a la izquierda para que "042931" sea un código válido.
 */
function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Crea un código nuevo e invalida los anteriores del mismo correo y propósito,
 * para que pedir un código de nuevo no deje varios válidos a la vez.
 *
 * Devuelve el código EN CLARO: solo viaja al email, en la base de datos únicamente
 * se guarda su SHA-256 (mismo criterio que `invitations.token_hash`).
 */
export async function issueVerificationCode(
  email: string,
  purpose: VerificationPurpose
): Promise<{ code: string; error: string | null }> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const rateLimit = await checkIssueRateLimit(admin, normalized);
  if (rateLimit.limited) {
    return { code: "", error: rateLimit.error };
  }

  await admin
    .from("verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", normalized)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  const { error } = await admin.from("verification_codes").insert({
    email: normalized,
    code_hash: hashCode(code),
    purpose,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { code: "", error: error.message };

  return { code, error: null };
}

/**
 * Comprueba y gasta un código. Un código solo sirve una vez.
 *
 * Los mensajes de error distinguen "caducado" de "incorrecto" a propósito: no
 * filtran nada útil a un atacante (ya tiene que conocer el correo) y evitan que
 * alguien se quede atascado sin saber que solo tiene que pedir otro código.
 */
export async function consumeVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  const cleanCode = code.replace(/\D/g, "");

  const { data: row } = await admin
    .from("verification_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("email", normalized)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { error: "No hay ningún código pendiente. Pide uno nuevo." };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "El código ha caducado. Pide uno nuevo." };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await admin
      .from("verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { error: "Demasiados intentos fallidos. Pide un código nuevo." };
  }

  // Comparación en tiempo constante: los dos lados son hashes hex de 64
  // caracteres, así que siempre tienen la misma longitud.
  const expected = Buffer.from(row.code_hash, "utf8");
  const provided = Buffer.from(hashCode(cleanCode), "utf8");
  const matches =
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided);

  if (!matches) {
    await admin
      .from("verification_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);

    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      error:
        left > 0
          ? `Código incorrecto. Te quedan ${left} intentos.`
          : "Código incorrecto. Pide un código nuevo.",
    };
  }

  await admin
    .from("verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { error: null };
}
