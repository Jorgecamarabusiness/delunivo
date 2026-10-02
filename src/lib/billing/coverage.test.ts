import assert from "node:assert/strict";
import { test } from "node:test";
import { usageCoverage } from "./coverage.ts";
const now = new Date("2026-10-01T15:00:00Z");
const rows = [0, 1, 2].map((h) => ({
  environment: "prod",
  starts_at: `2026-10-01T0${h}:00:00Z`,
  ends_at: `2026-10-01T0${h + 1}:00:00Z`,
  status: "complete",
}));
test("a recent successful import does not hide a historical coverage gap", () => {
  assert.equal(
    usageCoverage(
      rows,
      ["prod"],
      "2026-10-01T00:00:00Z",
      now.toISOString(),
      now,
    ).pending,
    false,
  );
  const incomplete = usageCoverage(
    [rows[0], rows[2]],
    ["prod"],
    "2026-10-01T00:00:00Z",
    now.toISOString(),
    now,
  );
  assert.equal(incomplete.pending, true);
  assert.equal(incomplete.missingHours, 1);
  assert.equal(
    Date.parse(incomplete.confirmedThrough!),
    Date.parse(rows[0].ends_at),
  );
  assert.equal(
    usageCoverage(
      rows,
      ["prod", "second"],
      "2026-10-01T00:00:00Z",
      now.toISOString(),
      now,
    ).pending,
    true,
  );
});
