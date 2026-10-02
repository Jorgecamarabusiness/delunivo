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
    let serverSessionId: string | null = null;
    let observedAt = Date.now();
    const estimateTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(30, (now - observedAt) / 1000);
      observedAt = now;
      if (!serverSessionId || !player.current || player.current.paused || player.current.ended || document.visibilityState !== "visible") return;
      // Playback telemetry is an estimate, never a billable or quota authority.
      void fetch(`/api/video/${videoAssetId}/estimate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: serverSessionId, seconds: elapsed }) }).catch(() => {});
    }, 30_000);
    const session = startPlaybackSession({
      async request(renew, signal) {
        const query = new URLSearchParams();
        if (!renew) query.set("check", "1");
        // A renewal admits a new bounded session; it never extends the old one.
        if (renew) serverSessionId = null;
        if (serverSessionId) query.set("session", serverSessionId);
        const response = await fetch(`/api/video/${videoAssetId}/playback?${query}`, { cache: "no-store", signal });
        const data = await response.json();
        if (typeof data.sessionId === "string") serverSessionId = data.sessionId;
        if (response.status === 410) serverSessionId = null;
        return { ok: response.ok, status: response.status, json: async () => data };
      },
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
      clearInterval(estimateTimer);
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
