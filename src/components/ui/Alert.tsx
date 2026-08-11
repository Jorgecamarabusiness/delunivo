import { type HTMLAttributes } from "react";

export type AlertVariant = "error" | "success" | "info" | "warning";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

const variantStyles: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-border bg-muted text-foreground",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

/**
 * Mensaje de estado de un formulario o de una página. `role="alert"` para que
 * los lectores de pantalla lo anuncien al aparecer.
 *
 * Ojo al testear: Next inyecta su propio `<div role="alert">` invisible
 * (`__next-route-announcer__`) en todas las páginas, así que un
 * `getByRole("alert")` sin acotar matchea ese en vez de este. Acota siempre por
 * el contenedor (p. ej. `page.locator("form").getByRole("alert")`).
 */
export function Alert({
  variant = "info",
  className = "",
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
