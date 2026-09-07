import crypto from "node:crypto";

export type VerificationPurpose = "signup" | "password_reset";

type RpcError = { message?: string } | null;

export type VerificationCodeRpcClient = {
  rpc: (
    functionName: string,
    params: Record<string, string>
  ) => Promise<{ data: unknown; error: RpcError }>;
};

type ConsumeStatus = "missing" | "expired" | "too_many_attempts" | "incorrect" | "consumed";
type ConsumeResult = { status: ConsumeStatus; attempts_left?: number };

const GENERIC_ISSUE_ERROR = "No hemos podido generar el código. Inténtalo de nuevo en unos minutos.";
const GENERIC_CONSUME_ERROR = "No hemos podido verificar el código. Inténtalo de nuevo.";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function isConsumeResult(value: unknown): value is ConsumeResult {
  if (!value || typeof value !== "object") return false;
  const result = value as { status?: unknown; attempts_left?: unknown };
  const statuses: ConsumeStatus[] = ["missing", "expired", "too_many_attempts", "incorrect", "consumed"];
  return typeof result.status === "string" && statuses.includes(result.status as ConsumeStatus) &&
    (result.attempts_left === undefined ||
      (typeof result.attempts_left === "number" && Number.isInteger(result.attempts_left) && result.attempts_left >= 0));
}

/** Uses the database RPC as the sole authority for issuance and rate limits. */
export async function issueVerificationCodeWithRpc(
  admin: VerificationCodeRpcClient,
  email: string,
  purpose: VerificationPurpose,
  createCode: () => string = generateCode
): Promise<{ code: string; error: string | null }> {
  const code = createCode();
  if (!isSixDigitCode(code)) return { code: "", error: GENERIC_ISSUE_ERROR };
  try {
    const { data, error } = await admin.rpc("issue_verification_code", {
      p_email: normalizeEmail(email), p_code_hash: hashCode(code), p_purpose: purpose,
    });
    if (error || typeof data !== "string") return { code: "", error: GENERIC_ISSUE_ERROR };
    switch (data) {
      case "issued": return { code, error: null };
      case "rate_limited_email": return { code: "", error: "Has pedido demasiados códigos seguidos. Espera unos minutos y vuelve a intentarlo." };
      case "rate_limited_global": return { code: "", error: "Ahora mismo no podemos enviar más códigos. Inténtalo en unos minutos." };
      default: return { code: "", error: GENERIC_ISSUE_ERROR };
    }
  } catch {
    return { code: "", error: GENERIC_ISSUE_ERROR };
  }
}

/** Uses the database RPC as the sole authority for attempts and one-time use. */
export async function consumeVerificationCodeWithRpc(
  admin: VerificationCodeRpcClient,
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<{ error: string | null }> {
  if (!isSixDigitCode(code)) return { error: "Introduce el código de 6 dígitos que te hemos enviado." };
  try {
    const { data, error } = await admin.rpc("consume_verification_code", {
      p_email: normalizeEmail(email), p_code_hash: hashCode(code), p_purpose: purpose,
    });
    if (error || !isConsumeResult(data)) return { error: GENERIC_CONSUME_ERROR };
    switch (data.status) {
      case "consumed": return { error: null };
      case "missing": return { error: "No hay ningún código pendiente. Pide uno nuevo." };
      case "expired": return { error: "El código ha caducado. Pide uno nuevo." };
      case "too_many_attempts": return { error: "Demasiados intentos fallidos. Pide un código nuevo." };
      case "incorrect": return {
        error: typeof data.attempts_left === "number" && data.attempts_left > 0
          ? `Código incorrecto. Te quedan ${data.attempts_left} intentos.`
          : "Código incorrecto. Pide un código nuevo.",
      };
    }
  } catch {
    return { error: GENERIC_CONSUME_ERROR };
  }
}
