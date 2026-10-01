export type UsageBucket = { id: string; at: number; seconds: number };
export type CapacityCycle = {
  id: string;
  start: number;
  end: number;
  baseSeconds: number;
  graceSeconds: number;
  increases?: { at: number; base: number; grace: number }[];
};
export type CapacityPack = {
  id: string;
  startsAt: number;
  expiresAt: number;
  seconds: number;
  refundedAt?: number | null;
};
export type Allocation = {
  usageId: string;
  cycleId: string | null;
  base: number;
  packs: { id: string; seconds: number }[];
  grace: number;
  excess: number;
};

/** Rebuild from canonical usage after every import correction. No mutable balance drift.
 * Hour aggregates belong to the instant at the start of that hour; provider does
 * not expose intra-hour times. All intervals are UTC [start,end).
 */
export function allocateUsage(
  usage: UsageBucket[],
  cycles: CapacityCycle[],
  packs: CapacityPack[],
): Allocation[] {
  const cycleSpent = new Map<string, { base: number; grace: number }>();
  const packSpent = new Map<string, number>();
  return [...usage]
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .map((row) => {
      if (!Number.isFinite(row.seconds) || row.seconds < 0)
        throw new Error("Consumo inválido.");
      const cycle = cycles.find((c) => row.at >= c.start && row.at < c.end);
      const result: Allocation = {
        usageId: row.id,
        cycleId: cycle?.id ?? null,
        base: 0,
        packs: [],
        grace: 0,
        excess: row.seconds,
      };
      if (!cycle) return result;
      const spent = cycleSpent.get(cycle.id) ?? { base: 0, grace: 0 };
      const increases = (cycle.increases ?? []).filter((i) => i.at <= row.at);
      const baseLimit =
        cycle.baseSeconds + increases.reduce((n, i) => n + i.base, 0);
      const graceLimit =
        cycle.graceSeconds + increases.reduce((n, i) => n + i.grace, 0);
      result.base = Math.min(
        result.excess,
        Math.max(0, baseLimit - spent.base),
      );
      result.excess -= result.base;
      spent.base += result.base;
      for (const pack of [...packs]
        .filter(
          (p) =>
            p.startsAt <= row.at &&
            row.at < p.expiresAt &&
            (!p.refundedAt || row.at < p.refundedAt),
        )
        .sort(
          (a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id),
        )) {
        const seconds = Math.min(
          result.excess,
          Math.max(0, pack.seconds - (packSpent.get(pack.id) ?? 0)),
        );
        if (seconds) result.packs.push({ id: pack.id, seconds });
        result.excess -= seconds;
        packSpent.set(pack.id, (packSpent.get(pack.id) ?? 0) + seconds);
      }
      result.grace = Math.min(
        result.excess,
        Math.max(0, graceLimit - spent.grace),
      );
      result.excess -= result.grace;
      spent.grace += result.grace;
      cycleSpent.set(cycle.id, spent);
      return result;
    });
}

export function latestCompleteHour(now: Date) {
  // Mux publishes only data ending at least 12 hours ago.
  return Math.floor(now.getTime() / 3600000) * 3600000 - 12 * 3600000;
}
