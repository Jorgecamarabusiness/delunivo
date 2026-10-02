export type DeliveryRow = { asset_id: string; delivered_seconds: number; delivered_seconds_by_resolution?: Record<string, number | undefined>; passthrough?: string; created_at?: string; asset_duration?: number };
export type DeliveryPage = { data: DeliveryRow[]; total_row_count: number; timeframe: number[] };
export type UsageSource = { page(start: number, end: number, page: number): Promise<DeliveryPage> };

/** Full pagination before replacing a window. A partial response never becomes a zero. */
export async function collectUsageHour(source: UsageSource, start: number): Promise<DeliveryRow[]> {
  if (!Number.isSafeInteger(start) || start % 3600 !== 0) throw new Error("invalid_hour");
  const rows: DeliveryRow[] = []; const seen = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; page <= 10000; page++) {
    const response = await source.page(start, start + 3600, page);
    if (!Array.isArray(response.data) || !Array.isArray(response.timeframe) || response.timeframe.length !== 2 || response.timeframe[0] !== start || response.timeframe[1] !== start + 3600 || !Number.isSafeInteger(response.total_row_count) || response.total_row_count < 0) {
      // Keep failed coverage explicit and expose only bounded numeric/type
      // metadata needed to diagnose provider contract drift, never raw bodies.
      const scalar = (value: unknown) => Number.isSafeInteger(value) ? String(value) : value === null ? "null" : typeof value;
      const window = Array.isArray(response.timeframe) ? response.timeframe.slice(0, 2).map(scalar).join(":") : typeof response.timeframe;
      const length = Array.isArray(response.timeframe) ? Math.min(response.timeframe.length, 99) : "not_array";
      throw new Error(`provider_window_mismatch requested=${start}:${start + 3600} observed=${window} timeframe_length=${length} count=${scalar(response.total_row_count)} data_array=${Array.isArray(response.data)}`);
    }
    if (expected !== undefined && expected !== response.total_row_count) throw new Error("provider_pagination_changed");
    expected = response.total_row_count;
    for (const row of response.data) {
      if (!row.asset_id || seen.has(row.asset_id) || !Number.isFinite(row.delivered_seconds) || row.delivered_seconds < 0) throw new Error("invalid_provider_usage");
      if (Object.values(row.delivered_seconds_by_resolution ?? {}).some((n) => n !== undefined && (!Number.isFinite(n) || n < 0))) throw new Error("invalid_resolution_usage");
      seen.add(row.asset_id); rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (rows.length > expected || response.data.length === 0) throw new Error("provider_pagination_incomplete");
  }
  throw new Error("provider_pagination_limit");
}
