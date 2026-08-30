import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Estilo compartido de todos los campos de texto. Antes estaba copiado
 * literalmente en cada formulario, así que cualquier retoque había que hacerlo
 * en quince sitios.
 */
export const inputClassName =
  "min-w-0 w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent disabled:opacity-50";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClassName} ${className}`.trim()} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${inputClassName} ${className}`.trim()} {...props} />
  );
}
