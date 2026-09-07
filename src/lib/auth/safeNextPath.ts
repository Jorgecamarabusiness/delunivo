/**
 * Solo rutas relativas propias — evita un open redirect a otro dominio.
 * Bloquea también "//evil.com", que el navegador trataría como URL absoluta.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("\\") || /[\u0000-\u0020\u007f]/.test(next)) return null;
  try {
    const decoded = decodeURIComponent(next);
    if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
  } catch { return null; }
  return next;
}
