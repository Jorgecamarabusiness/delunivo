/**
 * Elige negro o blanco para el texto que va ENCIMA del color de marca.
 *
 * Sin esto, una empresa que eligiera un color claro (amarillo, lima…) se
 * quedaría con botones de texto blanco sobre fondo claro, ilegibles — y
 * parecería un bug de Delunivo, no una mala elección de color.
 *
 * Usa la luminancia relativa y elige la opción con mayor contraste WCAG. No
 * usa un umbral visual aproximado: ese atajo falla con algunos tonos de marca.
 */
export function readableTextColor(hex: string | null): string | null {
  if (!hex) return null;

  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

  const darkLuminance = (10 / 255) / 12.92;
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  const whiteContrast = 1.05 / (luminance + 0.05);
  // Near middle gray neither #0a0a0a nor white quite reaches 4.5:1.
  if (Math.max(darkContrast, whiteContrast) < 4.5) return "#000000";
  return darkContrast >= whiteContrast ? "#0a0a0a" : "#ffffff";
}
