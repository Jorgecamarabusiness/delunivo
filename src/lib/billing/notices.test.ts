import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityNoticeContent } from "./notices.ts";

test("synthetic retention notice identifies deadline and export limitations", () => {
  const notice = capacityNoticeContent("retention", "ended", {
    deleteAfter: "2026-11-01T12:00:00Z",
  });
  assert.match(notice.paragraphs.join(" "), /2026-11-01T12:00:00Z/);
  assert.match(notice.paragraphs.join(" "), /originales disponibles/);
  assert.match(notice.paragraphs.join(" "), /independiente/);
});
