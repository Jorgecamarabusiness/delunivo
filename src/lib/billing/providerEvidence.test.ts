import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProviderEvidence } from "./providerEvidence.ts";
const value = {
  statement: {
    id: "synthetic",
    provider: "mux",
    environment: "isolated",
    currency: "usd",
    source: "Synthetic source",
    startsAt: "2026-09-01T00:00:00Z",
    endsAt: "2026-10-01T00:00:00Z",
    grossCents: 35,
    discountCents: 13,
    creditCents: 22,
    taxCents: 0,
    paidCents: 0,
  },
  lines: [],
};
test("supplier totals reconcile credits once and refuse invented conversion", () => {
  assert.equal(
    parseProviderEvidence(JSON.stringify(value)).statement.paidCents,
    0,
  );
  assert.throws(
    () =>
      parseProviderEvidence(
        JSON.stringify({
          ...value,
          statement: { ...value.statement, paidCents: 1 },
        }),
      ),
    /no concilian/,
  );
  assert.throws(
    () =>
      parseProviderEvidence(
        JSON.stringify({
          ...value,
          statement: { ...value.statement, usdToEur: 0.9 },
        }),
      ),
    /fuente y fecha/,
  );
});
test("ambiguous windows and duplicated source lines cannot enter the cost ledger", () => {
  const line = {
    key: "same",
    category: "delivery",
    amountMicroUnits: 1,
    startsAt: value.statement.startsAt,
    endsAt: value.statement.endsAt,
  };
  assert.throws(
    () =>
      parseProviderEvidence(JSON.stringify({ ...value, lines: [line, line] })),
    /duplicada/,
  );
  assert.throws(
    () =>
      parseProviderEvidence(
        JSON.stringify({
          ...value,
          lines: [{ ...line, endsAt: "2026-10-02T00:00:00Z" }],
        }),
      ),
    /fuera/,
  );
});
