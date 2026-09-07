import assert from "node:assert/strict";
import { test } from "node:test";
import { playbackTokenLifetimeSeconds, startPlaybackSession, PLAYBACK_ACCESS_CHECK_MS, type PlaybackState } from "./playbackSession.ts";

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const response = (status: number, data: Record<string, unknown>) => ({ status, ok: status === 200, json: async () => data });

test("playback expiry uses provider duration with a bounded margin, including 12 hours", () => {
  assert.equal(playbackTokenLifetimeSeconds(60), 960);
  assert.equal(playbackTokenLifetimeSeconds(43_200), 44_100);
  assert.equal(playbackTokenLifetimeSeconds(60.1), 961);
  for (const invalid of [0, -1, NaN, Infinity, 43_200.01]) assert.throws(() => playbackTokenLifetimeSeconds(invalid));
});

test("long sessions check access without resetting the token and renew before expiry", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const states: PlaybackState[] = [];
  const calls: boolean[] = [];
  const session = startPlaybackSession({
    request: async (renew) => {
      calls.push(renew);
      return response(200, renew ? { playbackId: "signed", token: `token-${calls.length}`, expiresAt: Date.now() + 16 * 60_000 } : { authorized: true });
    },
    onState: (state) => states.push(state),
  });
  await flush();
  for (let i = 0; i < 3; i++) { t.mock.timers.tick(PLAYBACK_ACCESS_CHECK_MS); await flush(); }
  assert.deepEqual(calls, [true, false, false, true]);
  assert.equal(states.length, 2, "permission checks preserve the current player grant");
  session.dispose();
});

test("revocation stops playback on the next check and does not automatically retry", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const states: PlaybackState[] = [];
  let calls = 0;
  const session = startPlaybackSession({ request: async () => ++calls === 1
    ? response(200, { playbackId: "signed", token: "grant", expiresAt: Date.now() + 44_100_000 })
    : response(403, { error: "revoked" }), onState: (state) => states.push(state) });
  await flush();
  t.mock.timers.tick(PLAYBACK_ACCESS_CHECK_MS); await flush();
  assert.equal(states.at(-1)?.kind, "error");
  t.mock.timers.tick(PLAYBACK_ACCESS_CHECK_MS); await flush();
  assert.equal(calls, 2);
  session.dispose();
});

test("network errors preserve valid playback but never retain an expired grant", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const states: PlaybackState[] = [];
  let calls = 0;
  const session = startPlaybackSession({ request: async () => {
    if (++calls > 1) throw new Error("offline");
    return response(200, { playbackId: "signed", token: "grant", expiresAt: Date.now() + 16 * 60_000 });
  }, onState: (state) => states.push(state) });
  await flush();
  t.mock.timers.tick(PLAYBACK_ACCESS_CHECK_MS); await flush();
  assert.equal(states.at(-1)?.kind, "ready");
  t.mock.timers.tick(11 * 60_000); await flush();
  assert.equal(states.at(-1)?.kind, "error");
  session.dispose();
});

test("concurrent resume checks are deduplicated and disposal ignores late responses", async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  let calls = 0;
  const states: PlaybackState[] = [];
  const session = startPlaybackSession({ request: () => { calls++; return new Promise((resolve) => { finish = resolve; }); }, onState: (state) => states.push(state) });
  await session.refresh(); await session.refresh();
  assert.equal(calls, 1);
  session.dispose();
  finish(response(200, { playbackId: "late", token: "late", expiresAt: Date.now() + 3_600_000 }));
  await flush();
  assert.equal(states.length, 0);
});
