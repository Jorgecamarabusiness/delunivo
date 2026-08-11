/**
 * Solo rutas relativas propias — evita un open redirect a otro dominio.
 * Bloquea también "//evil.com", que el navegador trataría como URL absoluta.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
