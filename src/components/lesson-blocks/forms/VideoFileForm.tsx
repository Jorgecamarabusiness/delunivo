"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MuxUploader from "@mux/mux-uploader-react";
import { Button } from "@/components/ui/Button";
import { MuxVideoBlock } from "@/components/lesson-blocks/MuxVideoBlock";
import {
  muxVideoStatusLabel,
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
  const [uploadFinished, setUploadFinished] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const { asset: muxAsset, error: muxStatusError } =
    useMuxVideoStatus(muxVideoAssetId);
  const isReplacing = Boolean(initialMuxVideoAssetId || initialUrl);

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

  useEffect(
    () => () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    },
    []
  );

  const createUploadEndpoint = useCallback(
    async (file?: File) => {
      if (!file) throw new Error("No se ha seleccionado ningún archivo.");
      const validationError = validateMuxVideoFile(file);
      if (validationError) throw new Error(validationError);

      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      const previewUrl = URL.createObjectURL(file);
      localPreviewRef.current = previewUrl;
      setLocalPreviewUrl(previewUrl);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
      }

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
    [blockId, lessonId, title]
  );

  const muxUploadFailed =
    muxAsset?.status === "errored" ||
    muxAsset?.status === "cancelled" ||
    muxAsset?.status === "timed_out" ||
    muxAsset?.status === "deleted";
  const canSubmit = Boolean(
    title.trim() &&
      ((muxVideoAssetId && uploadFinished && !muxUploadFailed) ||
        (initialMuxVideoAssetId &&
          muxVideoAssetId === initialMuxVideoAssetId &&
          !localPreviewUrl) ||
        (!muxVideoAssetId && legacyUrl && !localPreviewUrl))
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

        {localPreviewUrl ? (
          <div className="mt-2 max-w-lg">
            <video
              controls
              src={localPreviewUrl}
              className="aspect-video w-full rounded-md bg-muted"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Previsualización local del archivo elegido. Se guardará en la lección cuando pulses “{submitLabel}”.
            </p>
          </div>
        ) : muxVideoAssetId && muxAsset?.status === "ready" ? (
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

        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 sm:p-5">
          <p className="text-sm font-semibold">
            {isReplacing ? "Sustituir el vídeo actual" : "Subir un vídeo"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isReplacing
              ? "Arrastra aquí el nuevo archivo o selecciónalo. El vídeo actual no cambiará hasta que guardes."
              : "Arrastra aquí el archivo o selecciónalo. Cuando llegue al 100%, guarda el bloque antes de salir."}
          </p>
          <MuxUploader
            className="mt-3 block w-full"
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
          <p className="mt-3 text-sm font-medium" role="status">
            {uploadProgress < 100
              ? `Subiendo vídeo: ${Math.floor(uploadProgress)}%. No cierres esta página.`
              : "Subida completada al 100%. Falta guardar el vídeo en la lección."}
          </p>
        ) : null}

        {muxVideoAssetId ? (
          <p
            className={`mt-1 text-xs ${
              muxStatusError || muxUploadFailed
                ? "font-medium text-red-700"
                : "text-muted-foreground"
            }`}
          >
            {muxStatusError
              ? `Estado no disponible: ${muxStatusError}`
              : muxAsset
                ? muxVideoStatusLabel(muxAsset.status)
                : "Consultando estado…"}
          </p>
        ) : null}

        {muxAsset?.status === "errored" && muxAsset.errorMessage ? (
          <p className="mt-1 text-xs font-medium text-red-700">
            {muxAsset.errorMessage}
          </p>
        ) : null}

        {uploadFinished && !muxUploadFailed ? (
          <p className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            <strong>Último paso:</strong> pulsa “{submitLabel}”. Después sí puedes salir; Mux seguirá procesando el vídeo en segundo plano.
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
