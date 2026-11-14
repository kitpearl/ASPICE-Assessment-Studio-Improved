// API 연결 통합 테스트: handleEvaluate 가 기존 응답에 구조화 assessment 를 추가한다 (규칙 엔진만 사용, LLM 호출 없음).
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEvaluate } from "../../../api/_harnessService.js";
import { validateAssessment } from "../src/assessment/invariants.js";
import { assessmentFromVerdict } from "../src/assessment/fromVerdict.js";
import { deriveSummary } from "../src/assessment/summary.js";
import { REAL_BODY, REAL_STATE_BLOCKS, REAL_DECISION_BLOCKS, REAL_RATIO_BLOCKS } from "./fixtures/sup10Blocks.js";

const text = [...REAL_BODY, ...REAL_STATE_BLOCKS, ...REAL_DECISION_BLOCKS, ...REAL_RATIO_BLOCKS].map((b) => b.text).join("\n");

test("[real excerpt] handleEvaluate(rule) 는 기존 legacy·verdict 와 함께 유효한 assessment 를 돌려준다", async () => {
  const out = await handleEvaluate({ processId: "SUP.10", artifact: { name: "(문서번호)BSD_SUP10_CR_Plan_26.docx", text }, engine: "rule" }, {});
  assert.ok(out.legacy && out.verdict, "기존 응답 유지");
  const a = out.assessment;
  assert.ok(a, "assessment 생성");
  const v = validateAssessment(a);
  assert.deepEqual(v.schemaErrors, []);
  assert.deepEqual(v.violations, []);
  assert.equal(a.assessmentScope, "DOCUMENT_ADEQUACY");
  assert.equal(a.capabilityResult.status, "NOT_APPLICABLE");
  assert.equal(a.bpResults.length, 6);
  assert.match(a.engineVersion, /scorers=rule/);
  assert.ok(a.inputManifest[0].contentHash);
  // 규칙 엔진의 점수는 검색 점수로만 기록되고 등급과 분리된다
  assert.ok(a.bpResults.every((b) => b.retrievalScore !== null && b.rating.value !== undefined));
  // 문서 내부 일관성 검사가 실제 문서 발췌에서 동작한다
  const checks = Object.fromEntries(a.consistencyChecks.map((c) => [c.checkId, c.status]));
  assert.equal(checks["DOC-RATIO-MISMATCH"], "REVIEW");
  assert.equal(checks["DOC-STATE-MODEL"], "REVIEW");
  assert.equal(checks["DOC-DECISION-OUTCOME"], "REVIEW");
  assert.ok(out.assessmentSummary.conclusion.includes("판정하지 않는다"));
});

test("[synthetic] LLM 이 '적용'했다고 주장한 규칙은 조건 UNKNOWN 으로 검토 대기가 되고, 판독 불가 파일은 FAILED 로 기록된다", () => {
  const verdict = {
    processId: "SUP.10",
    bps: [{ id: "BP3", title: "t", rating: "L+", scorePercent: 80, evidence: [], gaps: [], findings: [], appliedRules: [{ ruleId: "SUP.10.RL.3", applied: true, note: "모든 관련자가 대표됨" }] }],
  };
  const a = assessmentFromVerdict(verdict, { artifacts: [{ name: "a.docx", text: "x" }], skipped: [{ name: "b.pdf", reason: "parse error" }], engines: ["hybrid"] });
  const rl3 = a.ruleEvaluations.find((r) => r.ruleId === "SUP.10.RL.3");
  assert.equal(rl3.conditionResult, "UNKNOWN");
  assert.equal(rl3.applicationStatus, "PENDING_REVIEW");
  assert.match(rl3.rationale, /UNKNOWN|미확정/);
  assert.equal(a.inputManifest.find((m) => m.fileName === "b.pdf").extractionStatus, "FAILED");
  assert.deepEqual(validateAssessment(a).violations, []);
});

test("[real excerpt] handleProject 는 프로세스별 assessment 를 추가하고, 문서가 없는 프로세스는 등급을 내지 않는다", async () => {
  const { handleProject } = await import("../../../api/_harnessService.js");
  const { verdict } = await handleProject({ processIds: ["SUP.10", "SUP.9"], artifacts: [{ name: "(문서번호)BSD_SUP10_CR_Plan_26.docx", text }], engine: "rule" }, {});
  assert.ok(verdict.processes.length === 2, "기존 응답 유지");
  const a10 = verdict.assessments["SUP.10"];
  assert.ok(a10);
  assert.deepEqual(validateAssessment(a10).violations, []);
  assert.ok(a10.bpResults.some((b) => b.rating.value !== null));
  const a9 = verdict.assessments["SUP.9"];
  assert.ok(a9, "SUP.9 도 구조화 평가 생성");
  assert.deepEqual(validateAssessment(a9).violations, []);
  assert.equal(a9.inputManifest.length, 0);
  assert.ok(a9.bpResults.every((b) => b.rating.value === null && b.rating.status === "WITHHELD"), "문서 부재를 N 으로 바꾸지 않는다");
  assert.ok(a9.consistencyChecks.some((c) => c.checkId === "INPUT-MISSING"));
  assert.ok(verdict.assessmentSummaries["SUP.9"].noFindingStatement === null);
});

// ── 실제 API 흐름(변환기)에서의 지적 충돌 해소·반대 증거 검색 ─────────────────
const hybridLikeVerdict = () => ({
  processId: "SUP.10",
  bps: [{
    id: "BP1", title: "t", rating: "F", scorePercent: 90, evidence: [], appliedRules: [],
    // 규칙 스코어러가 남긴 키워드 미확인 gap (하이브리드는 [rule] 접두)
    gaps: ["[rule] No evidence found for keywords: 개시자, 간의, 가나다라"],
    findings: [
      { id: "F-SUP.10.BP1-01", type: "strength", situation: "제안자와 고유 ID 자동 부여, 변경 사유 기록이 정의되어 있다", gap: "", evidence: [] },
      { id: "F-rule-SUP.10.BP1-01", type: "observation", situation: "개시자 등이 충분히 다루어지지 않음", gap: "", evidence: [] },
      { id: "F-SUP.10.BP1-02", type: "weakness", situation: "개시자 정보가 없다", gap: "", evidence: [] },
    ],
  }],
});

test("[real excerpt] 실제 흐름 1: 규칙 키워드 미확인은 기능어·동의어 반대 증거로 기각하고 사전에 없는 것만 후보로 남긴다", () => {
  const a = assessmentFromVerdict(hybridLikeVerdict(), { artifacts: [{ name: "plan.docx", text }], engines: ["hybrid"] });
  const gap = (kw) => a.findings.find((f) => f.findingId === `F-gap-SUP.10.BP1-${kw}`);
  assert.equal(gap("간의").disposition, "REJECTED");
  assert.match(gap("간의").dispositionReason, /기능어/);
  assert.equal(gap("개시자").disposition, "REJECTED");
  assert.match(gap("개시자").dispositionReason, /제안자/);
  assert.ok(gap("개시자").evidenceIds.length > 0, "반대 증거가 인용된다");
  assert.equal(gap("가나다라").disposition, "ACCEPTED");
  assert.match(gap("가나다라").dispositionReason, /후보로만/);
  assert.deepEqual(validateAssessment(a).violations, []);
});

test("[real excerpt] 실제 흐름 2: LLM 의 '개시자 없음' 약점은 반대 증거가 있으면 기각하지 않고 심사자 확인으로 보류한다", () => {
  const a = assessmentFromVerdict(hybridLikeVerdict(), { artifacts: [{ name: "plan.docx", text }], engines: ["hybrid"] });
  const w = a.findings.find((f) => f.findingId === "F-SUP.10.BP1-02");
  assert.equal(w.disposition, "DEFERRED");
  assert.match(w.dispositionReason, /심사자 확인/);
  const s = deriveSummary(a);
  assert.equal(s.findingCount, 0, "보류된 약점은 확정 약점으로 세지 않는다");
  assert.ok(s.openIssues.some((o) => o.kind === "FINDING_DEFERRED" && o.ref === "F-SUP.10.BP1-02"));
  assert.equal(s.noFindingStatement, null, "보류 사항이 있으면 'Finding 없음'이라고 하지 않는다");
});

test("[real excerpt] 증거 항목은 반대 증거로 인용된 블록만 만든다(문서 줄 수만큼 늘지 않는다)", () => {
  const a = assessmentFromVerdict(hybridLikeVerdict(), { artifacts: [{ name: "plan.docx", text }], engines: ["hybrid"] });
  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const cited = new Set(a.findings.flatMap((f) => f.evidenceIds));
  assert.ok(a.evidence.length > 0, "반대 증거가 있으면 증거 항목이 생긴다");
  assert.ok(a.evidence.length < lineCount / 2, `증거 ${a.evidence.length}건은 문서 줄 ${lineCount}개보다 훨씬 적어야 한다`);
  for (const e of a.evidence) assert.ok(cited.has(e.evidenceId), `${e.evidenceId} 는 인용되지 않았다`);
  assert.deepEqual(validateAssessment(a).violations, []);
});

test("[synthetic] 실제 흐름 3: 같은 기대사항에 대한 강점·약점 충돌을 탐지하고, 의미 판정이 없으면 둘 다 보류한다", () => {
  const verdict = {
    processId: "SUP.10",
    bps: [{
      id: "BP5", title: "t", rating: "L", scorePercent: 70, evidence: [], gaps: [], appliedRules: [],
      findings: [
        { id: "S1", type: "strength", situation: "변경 요청의 구현이 관련 이해관계자에 의해 종료 전에 확인된다", gap: "", evidence: [] },
        { id: "W1", type: "weakness", situation: "변경 요청의 구현이 관련 이해관계자에 의해 종료 전에 확인되는 절차가 정의되어 있지 않다", gap: "", evidence: [] },
      ],
    }],
  };
  // (a) 후보 문장은 있으나 의미 판정이 없다 → 충족 여부를 모르므로 둘 다 보류
  const a = assessmentFromVerdict(verdict, { artifacts: [{ name: "plan.docx", text: "구현 결과는 QA Lead 와 관련 이해관계자가 확인하고 종료한다" }], engines: ["hybrid"] });
  const s1 = a.findings.find((f) => f.findingId === "S1");
  const w1 = a.findings.find((f) => f.findingId === "W1");
  assert.deepEqual(s1.expectationIds, ["SUP.10.BP5.E1"]);
  assert.deepEqual(w1.expectationIds, ["SUP.10.BP5.E1"]);
  assert.ok(a.conflicts.some((c) => c.kind === "STRENGTH_VS_WEAKNESS" && c.expectationId === "SUP.10.BP5.E1" && c.resolution === "REVIEW_REQUIRED"));
  assert.equal(s1.disposition, "DEFERRED");
  assert.equal(w1.disposition, "DEFERRED");
  assert.deepEqual(validateAssessment(a).violations, [], "해소되지 않은 채 둘 다 채택되는 상태가 남지 않는다");
  // (b) 관련 문장이 전혀 없다 → 관찰되지 않음: 강점 주장을 기각하고 부족 지적을 채택
  const b = assessmentFromVerdict(verdict, { artifacts: [{ name: "plan.docx", text: "관련 없는 문장" }], engines: ["hybrid"] });
  assert.equal(b.findings.find((f) => f.findingId === "S1").disposition, "REJECTED");
  assert.equal(b.findings.find((f) => f.findingId === "W1").disposition, "ACCEPTED");
  assert.deepEqual(validateAssessment(b).violations, []);
});

test("[synthetic] 평가에 쓰인 문서가 없고 읽지 못한 파일만 있어도 등급을 싣지 않는다(입력 없음)", () => {
  const verdict = { processId: "SUP.9", bps: [{ id: "BP1", title: "t", rating: "N", scorePercent: 10, evidence: [], gaps: [], findings: [], appliedRules: [] }] };
  const a = assessmentFromVerdict(verdict, { artifacts: [], skipped: [{ name: "broken.pdf", reason: "parse error" }], engines: ["rule"] });
  assert.ok(a.bpResults.every((b) => b.rating.value === null && b.rating.status === "WITHHELD"));
  assert.ok(a.consistencyChecks.some((c) => c.checkId === "INPUT-MISSING"));
  assert.equal(a.inputManifest[0].extractionStatus, "FAILED");
  assert.deepEqual(validateAssessment(a).violations, []);
});
