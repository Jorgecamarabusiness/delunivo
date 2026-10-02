import { test } from "node:test";
import assert from "node:assert/strict";
import { collectUsageHour } from "./usageImport.ts";
test("full pagination includes deleted/unattributed assets and keeps precise seconds", async () => {
  const pages: number[] = [];
  const rows = await collectUsageHour({ async page(start, end, page) {
    pages.push(page); return { timeframe: [start, end], total_row_count: 2, data: [{ asset_id: `asset-${page}`, delivered_seconds: page + .123456 }] };
  } }, 3600);
  assert.deepEqual(pages, [1, 2]); assert.equal(rows[1].delivered_seconds, 2.123456);
});
test("empty complete window is known zero; incomplete, duplicate and shifted windows fail", async () => {
  assert.deepEqual(await collectUsageHour({ async page(start, end) { return { timeframe: [start, end], total_row_count: 0, data: [] }; } }, 0), []);
  await assert.rejects(collectUsageHour({ async page(start, end) { return { timeframe: [start, end], total_row_count: 1, data: [] }; } }, 0), /incomplete/);
  await assert.rejects(collectUsageHour({ async page(start, end) { return { timeframe: [start, end], total_row_count: 2, data: [{ asset_id: "x", delivered_seconds: 1 }] }; } }, 0), /invalid_provider/);
  await assert.rejects(collectUsageHour({ async page(start, end) { return { timeframe: [start + 1, end], total_row_count: 0, data: [] }; } }, 0), /window_mismatch/);
});

test("window mismatch diagnostics contain only bounded numeric/type metadata", async () => {
  await assert.rejects(collectUsageHour({ async page() {
    return { timeframe: ["private_token", 7200], total_row_count: null, data: [] } as unknown as Awaited<ReturnType<import("./usageImport.ts").UsageSource["page"]>>;
  } }, 3600), error => {
    assert.match(String(error), /requested=3600:7200 observed=string:7200 timeframe_length=2 count=null data_array=true/);
    assert.doesNotMatch(String(error), /private_token/);
    return true;
  });
  for (const timeframe of [[], [3600, 7200, 10800]]) {
    await assert.rejects(collectUsageHour({ async page() {
      return { timeframe, total_row_count: 0, data: [] };
    } }, 3600), new RegExp(`timeframe_length=${timeframe.length}`));
  }
});
