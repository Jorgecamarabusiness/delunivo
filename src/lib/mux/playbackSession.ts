import { validateMuxVideoDuration } from "./validation.ts";

export const PLAYBACK_ACCESS_CHECK_MS = 5 * 60_000;
const REFRESH_MARGIN_MS = 60_000;

// Mux requires expiry beyond the asset duration, including when seeking.
// https://www.mux.com/docs/guides/secure-video-playback#a-note-on-expiration-time
// Bound the grant to verified duration + 15 minutes, rather than a fixed long JWT.
export function playbackTokenLifetimeSeconds(duration: number): number {
  if (validateMuxVideoDuration(duration)) throw new Error("Duración de vídeo no válida.");
  return Math.ceil(duration) + 15 * 60;
}

export type PlaybackState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; playbackId: string; token: string; expiresAt: number; warning?: string };

type PlaybackResponse = {
  ok: boolean;
  status: number;
  json(): Promise<Record<string, unknown>>;
};

/** One in-flight authorization, periodic access checks and expiry on network loss. */
export function startPlaybackSession({
  request,
  onState,
}: {
  request: (renew: boolean, signal: AbortSignal) => Promise<PlaybackResponse>;
  onState: (state: PlaybackState) => void;
}) {
  let stopped = false;
  let pending = false;
  let ready: Extract<PlaybackState, { kind: "ready" }> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();

  function schedule(delay: number) {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(() => void refresh(), delay);
  }

  async function refresh() {
    if (stopped || pending) return;
    pending = true;
    const attempt = new AbortController();
    const requestTimeout = setTimeout(() => attempt.abort(), 15_000);
    const renew = !ready || Date.now() >= ready.expiresAt - REFRESH_MARGIN_MS;
    try {
      const response = await request(renew, AbortSignal.any([abort.signal, attempt.signal]));
      const data = await response.json();
      if (stopped) return;
      if ([401, 403, 404, 410].includes(response.status)) {
        ready = null;
        clearTimeout(timer);
        clearTimeout(expiryTimer);
        onState({ kind: "error", message: "El acceso al vídeo ha caducado o ya no está disponible. Vuelve a iniciar sesión o consulta con tu escuela." });
        return;
      }
      if (response.status === 409) {
        ready = null;
        clearTimeout(expiryTimer);
        if (data.status === "processing" || data.status === "waiting_for_upload") {
          onState({ kind: "loading", message: "El vídeo todavía se está procesando…" });
          schedule(10_000);
        } else {
          onState({ kind: "error", message: "El vídeo no está disponible. Consulta con tu escuela." });
        }
        return;
      }
      if (!response.ok) throw new Error("authorization_failed");
      if (renew) {
        if (
          typeof data.playbackId !== "string" || !data.playbackId ||
          typeof data.token !== "string" || !data.token ||
          typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt) ||
          data.expiresAt <= Date.now() + REFRESH_MARGIN_MS
        ) throw new Error("invalid_grant");
        ready = { kind: "ready", playbackId: data.playbackId, token: data.token, expiresAt: data.expiresAt };
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(() => {
          ready = null;
          onState({ kind: "error", message: "La autorización del vídeo ha caducado. Comprueba tu conexión y reintenta." });
        }, data.expiresAt - Date.now());
        onState(ready);
      } else if (data.authorized !== true) {
        throw new Error("invalid_check");
      } else if (ready?.warning) {
        ready = { ...ready, warning: undefined };
        onState(ready);
      }
      schedule(Math.min(PLAYBACK_ACCESS_CHECK_MS, Math.max(1_000, ready!.expiresAt - Date.now() - REFRESH_MARGIN_MS)));
    } catch {
      if (stopped) return;
      if (ready && ready.expiresAt > Date.now()) {
        ready = { ...ready, warning: "Sin conexión para verificar el acceso. Reintentando…" };
        onState(ready);
      } else {
        ready = null;
        onState({ kind: "error", message: "No se pudo autorizar el vídeo. Revisa tu conexión y reintenta." });
      }
      schedule(10_000);
    } finally {
      clearTimeout(requestTimeout);
      pending = false;
    }
  }

  void refresh();
  return {
    refresh,
    dispose() {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
      clearTimeout(expiryTimer);
    },
  };
}
