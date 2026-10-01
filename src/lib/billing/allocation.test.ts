import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateUsage, latestCompleteHour } from "./allocation.ts";
import { proratedSeconds, offerSnapshot } from "./catalog.ts";

test("upgrade exact half-cycle grants difference and floors seconds deterministically", () => {
  assert.equal(proratedSeconds(300000, 0, 100, 50), 150000);
  assert.equal(proratedSeconds(1, 0, 3, 1), 0);
  assert.equal(proratedSeconds(300000, 0, 100, 101), 0);
  assert.equal(offerSnapshot("crece").priceCents, 6900);
});
test("base then earliest-expiring pack then grace; packs carry between cycles", () => {
  const cycles = [
    { id: "c1", start: 0, end: 100, baseSeconds: 10, graceSeconds: 3 },
    { id: "c2", start: 100, end: 200, baseSeconds: 10, graceSeconds: 3 },
  ];
  const packs = [
    { id: "later", startsAt: 0, expiresAt: 190, seconds: 10 },
    { id: "earlier", startsAt: 0, expiresAt: 150, seconds: 5 },
  ];
  const r = allocateUsage(
    [
      { id: "u1", at: 1, seconds: 12 },
      { id: "u2", at: 100, seconds: 30 },
    ],
    cycles,
    packs,
  );
  assert.deepEqual(r[0].packs, [{ id: "earlier", seconds: 2 }]);
  assert.deepEqual(r[1].packs, [
    { id: "earlier", seconds: 3 },
    { id: "later", seconds: 10 },
  ]);
  assert.equal(r[1].grace, 3);
  assert.equal(r[1].excess, 4);
});
test("late correction rebuilds allocations; expiry and refund boundaries are exclusive", () => {
  const cycles = [
    { id: "c", start: 0, end: 100, baseSeconds: 10, graceSeconds: 2 },
  ];
  const packs = [
    { id: "p", startsAt: 5, expiresAt: 20, seconds: 3, refundedAt: 15 },
  ];
  const r = allocateUsage(
    [
      { id: "b", at: 15, seconds: 4 },
      { id: "a", at: 5, seconds: 11 },
    ],
    cycles,
    packs,
  );
  assert.equal(r[0].base, 10);
  assert.equal(r[0].packs[0].seconds, 1);
  assert.equal(r[1].packs.length, 0);
  assert.equal(r[1].grace, 2);
  assert.equal(r[1].excess, 2);
  assert.equal(
    allocateUsage([{ id: "a", at: 5, seconds: 5 }], cycles, packs)[0].packs
      .length,
    0,
  );
});
test("upgrade does not regenerate prior pack or grace spending", () => {
  const cycles = [
    {
      id: "c",
      start: 0,
      end: 100,
      baseSeconds: 10,
      graceSeconds: 2,
      increases: [{ at: 50, base: 5, grace: 1 }],
    },
  ];
  const r = allocateUsage(
    [
      { id: "a", at: 10, seconds: 12 },
      { id: "b", at: 50, seconds: 8 },
    ],
    cycles,
    [],
  );
  assert.equal(r[0].grace, 2);
  assert.equal(r[1].base, 5);
  assert.equal(r[1].grace, 1);
  assert.equal(r[1].excess, 2);
});
test("window is reliable only before the 12h publication delay", () => {
  assert.equal(
    latestCompleteHour(new Date("2026-10-01T14:37:00Z")),
    Date.parse("2026-10-01T02:00:00Z"),
  );
});
