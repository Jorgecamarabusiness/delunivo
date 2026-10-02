import { latestCompleteHour } from "./allocation.ts";
export function usageCoverage(
  rows: {
    environment: string;
    starts_at: string;
    ends_at: string;
    status: string;
    error_message?: string | null;
  }[],
  environments: string[],
  start: string,
  end: string,
  now = new Date(),
) {
  const first = Math.ceil(Date.parse(start) / 3600000) * 3600000;
  const last = Math.min(
    latestCompleteHour(now),
    Math.ceil(Date.parse(end) / 3600000) * 3600000,
  );
  const complete = new Set(
    rows
      .filter((r) => r.status === "complete")
      .map((r) => `${r.environment}:${Date.parse(r.starts_at)}`),
  );
  let missing = 0;
  let through = first;
  let contiguous = true;
  let expected = 0;
  for (let at = first; at < last; at += 3600000) {
    expected++;
    const covered =
      environments.length > 0 &&
      environments.every((env) => complete.has(`${env}:${at}`));
    if (!covered) {
      missing++;
      contiguous = false;
    } else if (contiguous) through = at + 3600000;
  }
  return {
    pending:
      !environments.length ||
      !expected ||
      missing > 0 ||
      rows.some((r) => r.status !== "complete" || r.error_message),
    missingHours: missing,
    expectedHours: expected,
    confirmedThrough: through > first ? new Date(through).toISOString() : null,
  };
}
