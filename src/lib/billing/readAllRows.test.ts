import test from "node:test";
import assert from "node:assert/strict";
import { readAllRows } from "./readAllRows.ts";
test("worker and ledgers read past the PostgREST cap without interpreting errors as zero", async () => {
  const schools = Array.from({ length: 2003 }, (_, id) => ({ id }));
  const calls: number[] = [];
  const full = await readAllRows(async (from, to) => {
    calls.push(from);
    return { data: schools.slice(from, to + 1), error: null };
  });
  assert.equal(full.data?.length, 2003);
  assert.deepEqual(calls, [0, 1000, 2000]);
  const failed = await readAllRows(async (from, to) =>
    from === 1000
      ? { data: null, error: { message: "unavailable" } }
      : { data: schools.slice(from, to + 1), error: null },
  );
  assert.equal(failed.data, null);
  assert.ok(failed.error);
});
