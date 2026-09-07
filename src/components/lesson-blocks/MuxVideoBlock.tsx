"use client";

import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react/lazy";
import type MuxPlayerElement from "@mux/mux-player";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { startPlaybackSession, type PlaybackState } from "@/lib/mux/playbackSession";

type Props = { videoAssetId: string; title?: string };

export function MuxVideoBlock(props: Props) {
  return <AuthorizedVideo key={props.videoAssetId} {...props} />;
}

function AuthorizedVideo({ videoAssetId, title }: Props) {
  const [state, setState] = useState<PlaybackState>({ kind: "loading", message: "Autorizando la reproducción…" });
  const player = useRef<MuxPlayerElement>(null);
  const resume = useRef({ time: 0, paused: true, rate: 1 });
  const refresh = useRef<() => void>(() => {});
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    const session = startPlaybackSession({
      request: (renew, signal) => fetch(`/api/video/${videoAssetId}/playback${renew ? "" : "?check=1"}`, { cache: "no-store", signal }),
      onState(next) {
        if (player.current && (next.kind !== "ready" || next.token !== lastToken.current)) {
          resume.current = { time: player.current.currentTime, paused: player.current.paused, rate: player.current.playbackRate };
        }
        if (next.kind === "ready") lastToken.current = next.token;
        setState(next);
      },
    });
    const onOnline = () => void session.refresh();
    refresh.current = onOnline;
    const onVisible = () => {
      if (document.visibilityState === "visible") void session.refresh();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      session.dispose();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [videoAssetId]);

  if (state.kind !== "ready") {
    return (
      <Card className="flex aspect-video w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p role={state.kind === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">{state.message}</p>
        {state.kind === "error" ? <Button type="button" variant="secondary" onClick={() => refresh.current()}>Reintentar reproducción</Button> : null}
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden">
      <MuxPlayer
        ref={player}
        className="aspect-video w-full"
        playbackId={state.playbackId}
        tokens={{ playback: state.token }}
        streamType="on-demand"
        videoTitle={title}
        metadata={{ video_id: videoAssetId, video_title: title ?? "Lección" }}
        onLoadedMetadata={() => {
          if (!player.current) return;
          player.current.currentTime = resume.current.time;
          player.current.playbackRate = resume.current.rate;
          if (!resume.current.paused) void player.current.play().catch(() => {});
        }}
      />
      {state.warning ? <p role="status" className="px-4 py-2 text-sm text-muted-foreground">{state.warning}</p> : null}
    </Card>
  );
}
