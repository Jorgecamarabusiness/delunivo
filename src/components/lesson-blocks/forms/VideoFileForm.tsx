"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadLessonMedia } from "@/lib/storage/uploadLessonMedia";
import { getVideoPreviewUrlAction } from "@/lib/storage/actions";

export function VideoFileForm({
  initialTitle = "",
  initialUrl = "",
  onCancel,
  onSubmit,
  isSaving,
  error,
  submitLabel,
}: {
  initialTitle?: string;
  initialUrl?: string;
  onCancel: () => void;
  onSubmit: (title: string, url: string) => void;
  isSaving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  // videoPath es lo que se persiste (ruta estable en el bucket); previewUrl es
  // solo para el <video> de este formulario y caduca a los 30 min.
  const [videoPath, setVideoPath] = useState(initialUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialUrl) return;
    let cancelled = false;

    getVideoPreviewUrlAction(initialUrl).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [initialUrl]);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const result = await uploadLessonMedia(file, "videos");

    setIsUploading(false);

    if (!result.path) {
      setUploadError(result.error ?? "No se pudo subir el vídeo.");
      return;
    }

    setVideoPath(result.path);
    setPreviewUrl(result.url);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !videoPath) return;
        onSubmit(title.trim(), videoPath);
      }}
    >
      <label className="block text-xs font-medium text-muted-foreground">
        Título
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
          placeholder="Ej. Clase 1"
        />
      </label>

      <div className="mt-4">
        <span className="block text-xs font-medium text-muted-foreground">
          Archivo de vídeo
        </span>

        {previewUrl ? (
          <video
            controls
            src={previewUrl}
            className="mt-2 aspect-video w-full max-w-sm rounded-md bg-muted"
          />
        ) : null}

        <label className="mt-2 inline-block">
          <span className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background">
            {isUploading
              ? "Subiendo..."
              : videoPath
                ? "Cambiar vídeo"
                : "Subir vídeo"}
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={isUploading}
            onChange={handleFileSelected}
          />
        </label>

        {uploadError ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {uploadError}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Error: {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!title.trim() || !videoPath || isSaving || isUploading}
        >
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
