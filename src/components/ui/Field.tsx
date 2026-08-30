import { type ReactNode } from "react";

/**
 * Etiqueta + control + ayuda opcional. `htmlFor` es obligatorio para que el
 * `<label>` quede asociado de verdad al campo — de eso dependen tanto los
 * lectores de pantalla como los tests, que localizan los campos por su etiqueta
 * (`getByLabel("Correo electrónico")`).
 */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`.trim()}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
