import { PLATFORM_URL } from "../brand.ts";

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function organizationPath(slug: string): string {
  return `/o/${segment(slug)}`;
}

export function coursePath(organizationSlug: string, courseId: string): string {
  return `${organizationPath(organizationSlug)}/cursos/${segment(courseId)}`;
}

export function platformUrl(path: string): string {
  return new URL(path, PLATFORM_URL).toString();
}

/** Convierte texto de contenido a una descripción breve sin etiquetas HTML. */
export function metadataDescription(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const text = value
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) return text.slice(0, 160);
  }

  return undefined;
}
