import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKoreanKeywords, extractBilingualKeywords, bpKeywordSources } from "../src/io/keywords.js";

test("korean keywords strip particles and stopwords", () => {
  const kws = extractKoreanKeywords("소프트웨어 요구사항을 구조화하고 우선순위를 정한다. 소프트웨어 요구사항의 분석을 수행한다.");
  assert.ok(kws.includes("요구사항"));
  assert.ok(kws.includes("우선순위"));
  assert.ok(kws.includes("구조화"));
  assert.ok(!kws.includes("정한다") && !kws.includes("수행") && !kws.includes("을"));
});

test("bilingual keeps both sets", () => {
  const r = extractBilingualKeywords({ ko: "양방향 추적성을 수립한다", en: "Establish bidirectional traceability" });
  assert.ok(r.ko.includes("추적성") && r.en.includes("traceability"));
  assert.deepEqual(extractBilingualKeywords({ en: "Establish bidirectional traceability" }).ko, []);
});

test("bpKeywordSources falls back to title/description for english-only BPs", () => {
  assert.deepEqual(bpKeywordSources({ title: "Ensure consistency", description: "between items" }).en, "Ensure consistency between items");
  const s = bpKeywordSources({ title: "일관성", description: "보장", titleEn: "Consistency", descriptionEn: "Ensure" });
  assert.equal(s.ko, "일관성 보장");
  assert.equal(s.en, "Consistency Ensure");
});
