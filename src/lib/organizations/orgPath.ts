import { cache } from "react";
import { headers } from "next/headers";

/**
 * "" si la petición llegó por el dominio raíz o por subdominio, o "/o/<slug>"
 * si llegó por ruta (ver src/proxy.ts). Cualquier enlace o redirect interno
 * de las páginas públicas (no /admin, que no depende de la URL) debe pasar
 * por orgPath() para no "escaparse" a otra organización al navegar.
 */
export const getOrgPathPrefix = cache(async (): Promise<string> => {
  const headerList = await headers();
  return headerList.get("x-org-path-prefix") ?? "";
});

export async function orgPath(path: string): Promise<string> {
  const prefix = await getOrgPathPrefix();
  return `${prefix}${path}`;
}
