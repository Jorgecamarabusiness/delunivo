"use client";

export async function uploadLessonMedia(
  file: File,
  folder: "images"
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

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
