const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "o"]);

function stripDiacritics(value: string): string {
  return Array.from(value.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      const isCombiningMark = code >= 0x0300 && code <= 0x036f;
      return !isCombiningMark;
    })
    .join("");
}

export function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export type OrganizationSlugValidation =
  | { ok: true; slug: string }
  | { ok: false; slug: string; error: string };

export function validateOrganizationSlug(value: string): OrganizationSlugValidation {
  const slug = slugify(value);

  if (!slug) {
    return { ok: false, slug, error: "Escribe un nombre para el enlace." };
  }

  if (slug.length > 63) {
    return {
      ok: false,
      slug,
      error: "El enlace no puede superar los 63 caracteres.",
    };
  }

  if (isReservedSlug(slug)) {
    return { ok: false, slug, error: "Ese nombre está reservado por Delunivo." };
  }

  return { ok: true, slug };
}
