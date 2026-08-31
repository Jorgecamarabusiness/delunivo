import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeLessonHtml } from "./sanitizeLessonHtml.ts";

test("keeps the lesson editor formatting that learners need", () => {
  const html = sanitizeLessonHtml(
    '<h2 style="text-align: center">Resumen</h2><p><strong>Hola</strong></p>'
  );

  assert.match(html, /<h2 style="text-align:center">Resumen<\/h2>/);
  assert.match(html, /<strong>Hola<\/strong>/);
});

test("removes executable markup and unsafe URLs", () => {
  const html = sanitizeLessonHtml(
    '<script>alert(1)</script><img src="javascript:alert(2)" onerror="alert(3)"><a href="https://example.com" onclick="alert(4)">Bien</a>'
  );

  assert.doesNotMatch(html, /script|javascript:|onerror|onclick/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("allows inline images without allowing data links", () => {
  const html = sanitizeLessonHtml(
    '<img src="data:image/png;base64,AAAA" alt="Vista"><a href="data:text/html,phishing">Abrir</a>'
  );

  assert.match(html, /src="data:image\/png;base64,AAAA"/);
  assert.doesNotMatch(html, /href="data:/);
});
