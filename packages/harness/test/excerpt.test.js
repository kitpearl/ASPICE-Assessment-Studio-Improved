import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExcerpt, extractKeywords, stripPamArtifacts } from "../src/io/excerpt.js";

test("extractKeywords: drops stopwords and short tokens", () => {
  const kws = extractKeywords(
    "Specify and document the functional and non-functional requirements for the system"
  );
  assert.ok(kws.includes("requirements"));
  assert.ok(kws.includes("functional"));
  assert.ok(!kws.includes("the"));
  assert.ok(!kws.includes("and"));
});

test("extractKeywords: drops generic connectives but keeps domain qualifiers", () => {
  const kws = extractKeywords(
    "According to the plan, ensure consistency including relevant measures, based on appropriate criteria. " +
    "Bidirectional traceability alone does not establish consistency.",
    12
  );
  // generic fillers must not surface
  for (const filler of ["according", "including", "based", "alone", "does"]) {
    assert.ok(!kws.includes(filler), `filler "${filler}" should be dropped (got ${kws.join(",")})`);
  }
  // domain-meaningful tokens (incl. kept qualifiers) must survive
  for (const keep of ["consistency", "traceability", "ensure", "establish", "relevant", "appropriate", "criteria", "measures"]) {
    assert.ok(kws.includes(keep), `"${keep}" should be kept (got ${kws.join(",")})`);
  }
});

test("stripPamArtifacts: cuts the leaked reversed-Outcome list + process header", () => {
  // Real shape from canonical spec (SWE.2.BP5): the description bleeds into the
  // next section's rotated "Outcome" header, extracted reversed as "emoctuO".
  const dirty =
    "Communicate the agreed software architecture to all affected parties. " +
    "SWE.2 Software Architectural Design 1 emoctuO 2 emoctuO 3 emoctuO 4 emoctuO";
  const clean = stripPamArtifacts(dirty);
  assert.equal(
    clean,
    "Communicate the agreed software architecture to all affected parties."
  );
  // Also handles the table-pipe variant (ACQ.4.BP5).
  assert.equal(
    stripPamArtifacts("...in the agreements. | | ACQ.4 Supplier Monitoring 1 emoctuO 2 emoctuO"),
    "...in the agreements."
  );
  // Clean text is returned unchanged.
  assert.equal(stripPamArtifacts("Analyze the software requirements."), "Analyze the software requirements.");
});

test("extractKeywords: PAM extraction artifacts never become keywords", () => {
  const kws = extractKeywords(
    "Communicate the agreed software architecture to all affected parties. " +
    "SWE.2 Software Architectural Design 1 emoctuO 2 emoctuO 3 emoctuO 4 emoctuO",
    10
  );
  assert.ok(!kws.some((k) => /emoctuo/i.test(k)), `unexpected artifact token in ${kws.join(",")}`);
  assert.ok(kws.includes("communicate"));
  assert.ok(kws.includes("architecture"));
});

test("buildExcerpt: keyword-targeted windows", () => {
  const text = "A".repeat(500) + " TRACEABILITY matters here " + "B".repeat(500);
  const artifacts = [{ name: "doc.md", text, wpidCandidates: ["13-51"] }];
  const out = buildExcerpt({ artifacts, keywords: ["traceability"], window: 80, perArtifactChars: 200 });
  assert.match(out, /TRACEABILITY matters here/);
  assert.match(out, /doc\.md/);
  assert.match(out, /13-51/);
});

test("buildExcerpt: falls back to head when no keyword hits", () => {
  const artifacts = [{ name: "x.md", text: "hello world".repeat(300) }];
  const out = buildExcerpt({ artifacts, keywords: ["missing-keyword"], perArtifactChars: 80 });
  assert.match(out, /hello world/);
  assert.match(out, /truncated/);
});

test("buildExcerpt: per-artifact truncation caps total size", () => {
  const big = "z".repeat(50000);
  const artifacts = [{ name: "a.md", text: big }, { name: "b.md", text: big }];
  const out = buildExcerpt({ artifacts, keywords: [], maxChars: 5000, perArtifactChars: 2000 });
  assert.ok(out.length <= 5200, `length was ${out.length}`);
});

test("buildExcerpt: 산출물 전체가 한도 안이면 자르지 않고 통째로 싣는다 (문서 뒷부분을 못 보는 오지적 방지)", () => {
  const long = "앞부분 ".repeat(1500) + "7. Closed 상태표 끝부분";
  const whole = buildExcerpt({ artifacts: [{ name: "plan.docx", text: long }], keywords: ["앞부분"] });
  assert.ok(whole.includes("7. Closed 상태표 끝부분"));
  // 한도를 넘으면 기존처럼 일부만
  const big = "가나다 ".repeat(8000);
  const cut = buildExcerpt({ artifacts: [{ name: "a", text: big }], keywords: ["가나다"] });
  assert.ok(cut.length <= 18000 && cut.length < big.length);
  // 호출자가 한도를 명시하면 그대로 따른다
  const capped = buildExcerpt({ artifacts: [{ name: "plan.docx", text: long }], keywords: [], perArtifactChars: 100 });
  assert.ok(!capped.includes("끝부분"));
});
