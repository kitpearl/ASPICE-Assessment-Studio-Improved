import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeFinding,
  makeEmptyStandardReferences,
  makeEmptyLocation,
  makeEmptyRatingImpact,
  validateFinding,
  findingsToLegacyEvidence,
  findingsToLegacyRationale,
} from "../src/model/finding.js";

test("makeFinding: fills empty slots when partial omits fields", () => {
  const f = makeFinding({ bpId: "SWE.2.BP1", situation: "정적 아키텍처 명세가 부분적으로 존재" });
  assert.equal(f.bpId, "SWE.2.BP1");
  assert.equal(f.type, "observation");
  assert.deepEqual(f.location, makeEmptyLocation());
  assert.deepEqual(f.standardReferences, makeEmptyStandardReferences());
  assert.deepEqual(f.ratingImpact, makeEmptyRatingImpact());
  assert.deepEqual(f.evidence, []);
});

test("makeFinding: keeps caller-supplied nested values and merges defaults", () => {
  const f = makeFinding({
    bpId: "SWE.2.BP1",
    type: "weakness",
    situation: "외부 인터페이스 상세 정의 미흡",
    gap: "외부 인터페이스에 대한 신호 폭/타이밍 정의 누락",
    recommendation: "추가하라: 외부 인터페이스 신호 폭·타이밍·에러 처리 정의",
    location: { recommended: "SAD §4.2 인터페이스 표" },
    standardReferences: { pam: ["PAM §SWE.2 BP1"] },
    ratingImpact: { ruleApplied: true, ruleId: "RR-NOT-DOCUMENTED", scoreDelta: -25, reason: "정의 미흡으로 감점" },
  });
  assert.equal(f.type, "weakness");
  assert.equal(f.location.found, null);
  assert.equal(f.location.recommended, "SAD §4.2 인터페이스 표");
  assert.deepEqual(f.standardReferences.pam, ["PAM §SWE.2 BP1"]);
  assert.deepEqual(f.standardReferences.bgbRL, []);
  assert.equal(f.ratingImpact.ruleApplied, true);
  assert.equal(f.ratingImpact.scoreDelta, -25);
});

test("validateFinding: rejects weakness without verb-first recommendation", () => {
  const f = makeFinding({
    bpId: "SWE.2.BP1",
    type: "weakness",
    situation: "정적 아키텍처 명세가 부분적으로 존재",
    gap: "외부 인터페이스 정의 누락",
    recommendation: "이 부분을 좀 더 잘 정리하면 좋겠음",
  });
  const v = validateFinding(f);
  assert.equal(v.ok, false);
  assert.match(v.reason, /동사/);
});

test("validateFinding: accepts weakness with verb-first recommendation", () => {
  const f = makeFinding({
    bpId: "SWE.2.BP1",
    type: "weakness",
    situation: "정적 아키텍처 명세가 부분적으로 존재",
    gap: "외부 인터페이스 정의 누락",
    recommendation: "추가하라: 외부 인터페이스 신호 폭·타이밍 정의",
  });
  const v = validateFinding(f);
  assert.equal(v.ok, true);
});

test("validateFinding: observation 은 recommendation 없어도 통과", () => {
  const f = makeFinding({
    bpId: "SWE.2.BP1",
    type: "observation",
    situation: "정적 아키텍처 명세가 존재함",
  });
  const v = validateFinding(f);
  assert.equal(v.ok, true);
});

test("validateFinding: weakness 는 gap 이 필수", () => {
  const f = makeFinding({
    bpId: "SWE.2.BP1",
    type: "weakness",
    situation: "정적 아키텍처 명세가 부분적으로 존재",
    recommendation: "추가하라: 외부 인터페이스 정의",
  });
  const v = validateFinding(f);
  assert.equal(v.ok, false);
  assert.match(v.reason, /gap/);
});

test("findingsToLegacyEvidence: evidence 가 있으면 평탄화", () => {
  const findings = [
    makeFinding({
      bpId: "SWE.2.BP1",
      type: "weakness",
      gap: "x",
      recommendation: "추가하라 x",
      evidence: [
        { artifactName: "SAD.docx", quote: "본 명세는 …", location: "§4.1" },
        { artifactName: "SAD.docx", quote: "외부 인터페이스 …", location: "§4.2" },
      ],
      location: { found: "SAD §4" },
    }),
  ];
  const out = findingsToLegacyEvidence(findings);
  assert.equal(out.length, 2);
  assert.equal(out[0].artifactName, "SAD.docx");
  assert.equal(out[0].location, "§4.1");
  // ev.location 이 비어있으면 finding.location.found 로 폴백되는 경로도 검증
  const findings2 = [
    makeFinding({
      bpId: "SWE.2.BP1",
      type: "weakness",
      gap: "x",
      recommendation: "추가하라 x",
      evidence: [{ artifactName: "SAD.docx", quote: "..." }],
      location: { found: "SAD §4" },
    }),
  ];
  const out2 = findingsToLegacyEvidence(findings2);
  assert.equal(out2[0].location, "SAD §4");
});

test("findingsToLegacyEvidence: evidence 없이 권고 위치만 있으면 가상 evidence 생성", () => {
  const findings = [
    makeFinding({
      bpId: "SWE.2.BP1",
      type: "weakness",
      gap: "외부 인터페이스 정의 누락",
      recommendation: "추가하라: 인터페이스 표",
      location: { found: null, recommended: "SAD §4.2 인터페이스 표" },
    }),
  ];
  const out = findingsToLegacyEvidence(findings);
  assert.equal(out.length, 1);
  assert.match(out[0].location, /권고 위치/);
  assert.match(out[0].location, /SAD §4\.2/);
  assert.equal(out[0].quote, "외부 인터페이스 정의 누락");
});

test("findingsToLegacyRationale: weakness 만 추출하여 gap 만 직렬화 (권고 제외)", () => {
  const findings = [
    makeFinding({ bpId: "x", type: "strength", situation: "긍정 관찰" }),
    makeFinding({
      bpId: "x",
      type: "weakness",
      gap: "외부 인터페이스 정의 누락",
      recommendation: "추가하라: 인터페이스 표",
    }),
  ];
  const r = findingsToLegacyRationale(findings, ["legacy gap"]);
  // 권고(recommendation)는 BP 평가 결과에서 제외하므로 gap 만 직렬화된다.
  assert.equal(r, "외부 인터페이스 정의 누락");
});

test("findingsToLegacyRationale: findings 없으면 legacy gaps 폴백", () => {
  assert.equal(findingsToLegacyRationale(undefined, ["a", "b"]), "a / b");
  assert.equal(findingsToLegacyRationale([], ["a"]), "a");
  assert.equal(findingsToLegacyRationale([], []), "");
});
