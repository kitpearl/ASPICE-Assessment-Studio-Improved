import { test } from "node:test";
import assert from "node:assert/strict";
import { toLegacyShape } from "../../../api/_legacyAdapter.js";

test("toLegacyShape passes references and prefixes basis", () => {
  const legacy = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "F", scorePercent: 90, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP1", references: { pam: { citation: "PAM 4.1 §4.4.1 SWE.1.BP1", page: 50 }, guideline: [] }, appliedRules: [] }], pas: [], capabilityLevel: 1, capabilityLevelReason: "ok" });
  assert.equal(legacy.ratings[0].references.pam.page, 50);
  assert.match(legacy.summary, /^기준: PAM 4\.1 · Guidelines 2026 · CL1/);
});

test("toLegacyShape defaults appliedRules to [] and tolerates missing references", () => {
  const legacy = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "N", scorePercent: 0, evidence: [], gaps: [] }], capabilityLevel: 0, capabilityLevelReason: "x" });
  assert.deepEqual(legacy.ratings[0].appliedRules, []);
  assert.equal(legacy.ratings[0].references, undefined);
  const withRules = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "P-", scorePercent: 20, evidence: [], gaps: [], appliedRules: [{ ruleId: "SWE.1.RL.4", applied: true, note: "n" }] }], capabilityLevel: 0 });
  assert.equal(withRules.ratings[0].appliedRules[0].ruleId, "SWE.1.RL.4");
});

test("[synthetic] 약점 Finding 이 있으면 점수가 높아도 요약에 나타나고 '특이 Finding 없음'이 아니며 강점에서 빠진다", () => {
  const longGap = "구현된 변경 요청의 확인 절차가 구현 후 검증과 회귀 검증으로 언급되어 있으나 관련 이해관계자에 의한 확인이 정의되어 있지 않다.";
  const mk = (id, findings, score = 72) => ({ id, title: "t", rating: "L+", scorePercent: score, evidence: [], gaps: [], findings, appliedRules: [] });
  const legacy = toLegacyShape({
    bps: [
      mk("BP1", [{ type: "strength", situation: "고유 ID 자동 부여" }]),
      mk("BP5", [{ type: "weakness", situation: longGap, gap: "" }]),
      mk("BP6", [{ type: "observation", situation: "참고" }]),
    ],
    pas: [], capabilityLevel: 1, capabilityLevelReason: "ok",
  });
  assert.match(legacy.gaps, /BP5/);
  assert.doesNotMatch(legacy.gaps, /특이 Finding 없음/);
  assert.match(legacy.strengths, /BP1/);
  assert.doesNotMatch(legacy.strengths, /BP5|BP6/);
  const bp5 = legacy.ratings.find((r) => r.bp === "BP5");
  assert.match(bp5.rationale, /관련 이해관계자에 의한 확인이 정의되어 있지 않다/, "60자에서 잘리지 않는다");
  assert.match(legacy.summary, /실제 수행에 따른 PA\/CL 달성은 수행 증거 없이 확정하지 않음/);
});

test("[synthetic] 규칙 엔진 결과처럼 강점 Finding 이 전혀 없으면 점수만으로 강점을 만들지 않는다", () => {
  const legacy = toLegacyShape({
    bps: [{ id: "BP1", title: "t", rating: "F", scorePercent: 97, evidence: [], gaps: ["No evidence found for keywords: 개시자"], findings: [{ type: "observation", situation: "점검" }], appliedRules: [] }],
    pas: [], capabilityLevel: 1,
  });
  assert.equal(legacy.strengths, "강점으로 식별된 BP 없음");
  assert.match(legacy.gaps, /확정된 약점 없음 · 검토 필요 관찰 1건/);
});
