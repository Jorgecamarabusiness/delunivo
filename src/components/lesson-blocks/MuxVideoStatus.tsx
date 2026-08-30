"use client";

import { useEffect, useState } from "react";
import type { MuxVideoStatus as Status } from "@/lib/mux/events";

type VideoAssetState = {
  status: Status;
  errorMessage: string | null;
};

const LABELS: Record<Status, string> = {
  waiting_for_upload: "Esperando la carga",
  processing: "Mux está procesando el vídeo",
  ready: "Vídeo listo",
  errored: "Error al procesar el vídeo",
  cancelled: "Carga cancelada",
  timed_out: "La carga ha caducado",
  deleted: "Vídeo eliminado",
};

const TERMINAL = new Set<Status>([
  "ready",
  "errored",
  "cancelled",
  "timed_out",
  "deleted",
]);

export function useMuxVideoStatus(videoAssetId?: string) {
  const [asset, setAsset] = useState<VideoAssetState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoAssetId) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const response = await fetch(`/api/admin/mux/video-assets/${videoAssetId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          status?: Status;
          errorMessage?: string | null;
          error?: string;
        };

        if (!response.ok || !data.status) {
          throw new Error(data.error ?? "No se pudo consultar el vídeo.");
        }
        if (cancelled) return;

        setAsset({ status: data.status, errorMessage: data.errorMessage ?? null });
        setError(null);
        if (!TERMINAL.has(data.status)) timeout = setTimeout(refresh, 5_000);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el vídeo.");
        timeout = setTimeout(refresh, 10_000);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [videoAssetId]);

  return { asset, error };
}

export function MuxVideoStatus({ videoAssetId }: { videoAssetId: string }) {
  const { asset, error } = useMuxVideoStatus(videoAssetId);
  if (error) return <span className="text-xs text-muted-foreground">Estado no disponible</span>;
  if (!asset) return <span className="text-xs text-muted-foreground">Consultando estado…</span>;

  return (
    <span className="text-xs text-muted-foreground" title={asset.errorMessage ?? undefined}>
      {LABELS[asset.status]}
    </span>
  );
}
