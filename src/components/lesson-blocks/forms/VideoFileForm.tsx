"use client";

import { useCallback, useEffect, useState } from "react";
import MuxUploader from "@mux/mux-uploader-react";
import { Button } from "@/components/ui/Button";
import { MuxVideoBlock } from "@/components/lesson-blocks/MuxVideoBlock";
import {
  MuxVideoStatus,
  useMuxVideoStatus,
} from "@/components/lesson-blocks/MuxVideoStatus";
import {
  MAX_MUX_VIDEO_KILOBYTES,
  validateMuxVideoFile,
} from "@/lib/mux/validation";
import { getVideoPreviewUrlAction } from "@/lib/storage/actions";

export type VideoFileSelection =
  | { muxVideoAssetId: string; legacyUrl?: never }
  | { muxVideoAssetId?: never; legacyUrl: string };

export function VideoFileForm({
  lessonId,
  blockId,
  initialTitle = "",
  initialUrl = "",
  initialMuxVideoAssetId,
  onCancel,
  onSubmit,
  isSaving,
  error,
  submitLabel,
}: {
  lessonId: string;
  blockId: string;
  initialTitle?: string;
  initialUrl?: string;
  initialMuxVideoAssetId?: string;
  onCancel: () => void;
  onSubmit: (title: string, selection: VideoFileSelection) => void;
  isSaving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [legacyUrl] = useState(initialUrl);
  const [legacyPreviewUrl, setLegacyPreviewUrl] = useState<string | null>(null);
  const [muxVideoAssetId, setMuxVideoAssetId] = useState(initialMuxVideoAssetId);
  const [uploadFinished, setUploadFinished] = useState(Boolean(initialMuxVideoAssetId));
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { asset: muxAsset } = useMuxVideoStatus(muxVideoAssetId);

  useEffect(() => {
    if (!initialUrl || initialMuxVideoAssetId) return;
    let cancelled = false;

    getVideoPreviewUrlAction(initialUrl).then((url) => {
      if (!cancelled) setLegacyPreviewUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [initialMuxVideoAssetId, initialUrl]);

  const createUploadEndpoint = useCallback(
    async (file?: File) => {
      if (!file) throw new Error("No se ha seleccionado ningún archivo.");
      const validationError = validateMuxVideoFile(file);
      if (validationError) throw new Error(validationError);

      setUploadError(null);
      setUploadFinished(false);
      setUploadProgress(0);

      const response = await fetch("/api/admin/mux/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          blockId,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      const data = (await response.json()) as {
        videoAssetId?: string;
        uploadUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.videoAssetId || !data.uploadUrl) {
        throw new Error(data.error ?? "No se pudo preparar la carga.");
      }

      setMuxVideoAssetId(data.videoAssetId);
      return data.uploadUrl;
    },
    [blockId, lessonId]
  );

  const canSubmit = Boolean(
    title.trim() &&
      ((muxVideoAssetId && uploadFinished) || (!muxVideoAssetId && legacyUrl))
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;

        if (muxVideoAssetId) onSubmit(title.trim(), { muxVideoAssetId });
        else onSubmit(title.trim(), { legacyUrl });
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
          maxLength={200}
        />
      </label>

      <div className="mt-4">
        <span className="block text-xs font-medium text-muted-foreground">
          Archivo de vídeo
        </span>

        {muxVideoAssetId && muxAsset?.status === "ready" ? (
          <div className="mt-2 max-w-lg">
            <MuxVideoBlock videoAssetId={muxVideoAssetId} title={title} />
          </div>
        ) : legacyPreviewUrl && !muxVideoAssetId ? (
          <video
            controls
            src={legacyPreviewUrl}
            className="mt-2 aspect-video w-full max-w-sm rounded-md bg-muted"
          />
        ) : null}

        <div className="mt-3 rounded-md border border-border p-3">
          <MuxUploader
            endpoint={createUploadEndpoint}
            locale="es"
            pausable
            dynamicChunkSize
            useLargeFileWorkaround
            maxFileSize={MAX_MUX_VIDEO_KILOBYTES}
            onUploadStart={() => {
              setUploadError(null);
              setUploadFinished(false);
              setUploadProgress(0);
            }}
            onProgress={(event) =>
              setUploadProgress((event as CustomEvent<number>).detail)
            }
            onUploadError={(event) => {
              setUploadFinished(false);
              setUploadError(event.detail.message);
            }}
            onSuccess={() => {
              setUploadFinished(true);
              setUploadProgress(100);
            }}
          />
        </div>

        {uploadProgress !== null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Progreso de carga: {Math.floor(uploadProgress)}%
          </p>
        ) : null}

        {muxVideoAssetId ? (
          <p className="mt-1">
            <MuxVideoStatus videoAssetId={muxVideoAssetId} />
          </p>
        ) : null}

        {muxAsset?.status === "errored" && muxAsset.errorMessage ? (
          <p className="mt-1 text-xs font-medium text-red-700">
            {muxAsset.errorMessage}
          </p>
        ) : null}

        {uploadFinished && muxAsset?.status !== "ready" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            La carga terminó. Puedes guardar el bloque mientras Mux procesa el vídeo.
          </p>
        ) : null}

        {uploadError ? (
          <p className="mt-2 text-xs font-medium text-red-700">{uploadError}</p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Error: {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit || isSaving}>
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
