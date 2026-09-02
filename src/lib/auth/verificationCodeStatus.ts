const RATE_WINDOW_MINUTES = 15;

export function issueStatusError(status: unknown): string | null {
  if (status === "issued") return null;
  if (status === "rate_limited_email") {
    return `Has pedido demasiados códigos seguidos. Espera ${RATE_WINDOW_MINUTES} minutos y vuelve a intentarlo.`;
  }
  if (status === "rate_limited_global") {
    return "Ahora mismo no podemos enviar más códigos. Inténtalo en unos minutos.";
  }
  return "No se pudo generar el código de verificación.";
}

type ConsumeStatus = { status?: unknown; attempts_left?: unknown };

export function consumeStatusError(result: unknown): string | null {
  const value = (result ?? {}) as ConsumeStatus;
  if (value.status === "consumed") return null;
  if (value.status === "expired") {
    return "El código ha caducado. Pide uno nuevo.";
  }
  if (value.status === "too_many_attempts") {
    return "Demasiados intentos fallidos. Pide un código nuevo.";
  }
  if (value.status === "incorrect") {
    const left = Number(value.attempts_left);
    return Number.isInteger(left) && left > 0
      ? `Código incorrecto. Te quedan ${left} intentos.`
      : "Código incorrecto. Pide un código nuevo.";
  }
  return "No hay ningún código pendiente. Pide uno nuevo.";
}
