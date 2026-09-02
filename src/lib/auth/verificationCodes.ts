import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeStatusError,
  issueStatusError,
} from "@/lib/auth/verificationCodeStatus";

export type VerificationPurpose = "signup" | "password_reset";

/** Minutos que vive un código antes de caducar. */
export const CODE_TTL_MINUTES = 30;


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
  const code = generateCode();
  const { data, error } = await admin.rpc("issue_verification_code", {
    p_email: normalized,
    p_code_hash: hashCode(code),
    p_purpose: purpose,
  });

  if (error) return { code: "", error: error.message };

  const statusError = issueStatusError(data);
  if (statusError) return { code: "", error: statusError };

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
  const { data, error } = await admin.rpc("consume_verification_code", {
    p_email: normalized,
    p_code_hash: hashCode(cleanCode),
    p_purpose: purpose,
  });

  if (error) return { error: error.message };
  return { error: consumeStatusError(data) };
}

/** Revoca códigos emitidos durante un alta que después tuvo que deshacerse. */
export async function revokeVerificationCodes(
  email: string,
  purpose: VerificationPurpose
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email.trim().toLowerCase())
    .eq("purpose", purpose)
    .is("consumed_at", null);
}
