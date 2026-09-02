"use client";

export type PublicImageScope =
  | { type: "brand" }
  | { type: "course"; id: string }
  | { type: "lesson"; id: string };

export async function uploadPublicImage(
  file: File,
  scope: PublicImageScope
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scopeType", scope.type);
  if ("id" in scope) formData.append("scopeId", scope.id);

  const response = await fetch("/api/admin/media/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    return { path: null, url: null, error: data.error ?? "No se pudo subir el archivo." };
  }

  return { path: data.path, url: data.url ?? null, error: null };
}
