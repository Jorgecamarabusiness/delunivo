import { type HTMLAttributes } from "react";

export type ContainerWidth = "sm" | "md" | "lg";

const widths: Record<ContainerWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
};

/**
 * Ancho y márgenes laterales consistentes. Las páginas usaban max-w-2xl,
 * 3xl, 4xl, 5xl y 6xl mezclados sin criterio, así que el contenido no se
 * alineaba entre unas y otras.
 */
export function Container({
  width = "lg",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { width?: ContainerWidth }) {
  return (
    <div
      className={`mx-auto w-full ${widths[width]} px-4 sm:px-6 ${className}`.trim()}
      {...props}
    />
  );
}
