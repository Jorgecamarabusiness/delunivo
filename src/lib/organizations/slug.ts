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
