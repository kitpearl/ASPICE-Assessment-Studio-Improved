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

test("korean compound particles and verb endings are stripped", () => {
  const kws = extractKoreanKeywords("이해관계자와의 합의는 시스템에서는 요구사항과의 일관성이 검토되어야 하며 승인되고 관리되며 구현할 수 있도록 확인해야 한다");
  for (const k of ["이해관계자", "시스템", "요구사항", "일관성"]) assert.ok(kws.includes(k), `missing ${k}: ${kws}`);
  for (const k of ["이해관계자와", "시스템에서", "요구사항과", "검토되어야", "관리되며", "승인되고", "구현할", "확인해야", "있도록", "하며"]) {
    assert.ok(!kws.includes(k), `junk ${k}`);
  }
});

test("산출물 is kept as a keyword", () => {
  assert.ok(extractKoreanKeywords("산출물을 검토한다").includes("산출물"));
});
