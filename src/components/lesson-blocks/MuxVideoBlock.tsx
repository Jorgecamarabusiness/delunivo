"use client";

import { useEffect, useState } from "react";
import MuxPlayer from "@mux/mux-player-react/lazy";
import { Card } from "@/components/ui/Card";

type PlaybackState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; playbackId: string; token: string };

export function MuxVideoBlock({
  videoAssetId,
  title,
}: {
  videoAssetId: string;
  title?: string;
}) {
  const [state, setState] = useState<PlaybackState>({
    kind: "loading",
    message: "Autorizando la reproducción…",
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function authorize() {
      try {
        const response = await fetch(`/api/video/${videoAssetId}/playback`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          playbackId?: string;
          token?: string;
          error?: string;
        };
        if (cancelled) return;

        if (response.status === 409) {
          setState({ kind: "loading", message: "Mux todavía está procesando este vídeo…" });
          timeout = setTimeout(authorize, 10_000);
          return;
        }
        if (!response.ok || !data.playbackId || !data.token) {
          setState({ kind: "error", message: data.error ?? "No se pudo reproducir el vídeo." });
          return;
        }

        setState({ kind: "ready", playbackId: data.playbackId, token: data.token });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "No se pudo autorizar el vídeo. Revisa tu conexión." });
        }
      }
    }

    void authorize();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [videoAssetId]);

  if (state.kind !== "ready") {
    return (
      <Card className="flex aspect-video w-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">{state.message}</p>
      </Card>
    );
  }

  return (
    <Card className="aspect-video w-full overflow-hidden">
      <MuxPlayer
        className="h-full w-full"
        playbackId={state.playbackId}
        tokens={{ playback: state.token }}
        streamType="on-demand"
        videoTitle={title}
        metadata={{ video_id: videoAssetId, video_title: title ?? "Lección" }}
      />
    </Card>
  );
}
