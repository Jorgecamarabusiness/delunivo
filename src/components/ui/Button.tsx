import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "neutral" | "secondary" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const variantStyles: Record<ButtonVariant, string> = {
  // `primary` usa el color de marca de la empresa (--accent, que el layout raíz
  // sobreescribe con organizations.primary_color). Antes era negro fijo, así que
  // cambiar el color de marca no se notaba en ningún botón del sitio.
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  neutral: "bg-foreground text-background hover:bg-foreground/90",
  secondary: "bg-muted text-foreground hover:bg-border",
  outline:
    "border border-border text-foreground hover:bg-foreground hover:text-background",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
) {
  return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim();
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={buttonClassName(variant, size, className)}
      {...props}
    />
  );
});
