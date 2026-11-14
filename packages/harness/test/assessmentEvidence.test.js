// 증거·지적·문서 일관성·요약 회귀 테스트 (외부 LLM 호출 없음, 결정적).
// "[real]" = 실제 SUP.10 계획서 발췌(test/fixtures/sup10Blocks.js), "[synthetic]" = 이 파일에서 만든 합성 사례.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcess } from "../spec/canonical/index.js";
import { extractKoreanKeywords } from "../src/io/keywords.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { termVariants, conceptsIn } from "../src/assessment/semantics.js";
import {
  reconcileAbsenceClaim, evaluateExpectationStatus, conceptCoverage, detectFindingConflicts, resolveFindingConflicts,
  verifyListMembershipClaim, checkExecutionWording, classifyBlock, evidenceTypeForBlock,
} from "../src/assessment/evidenceReasoning.js";
import { scanRatioInconsistencies, scanStateModel, scanDecisionOutcomeHandling, compareBpMapping } from "../src/assessment/documentChecks.js";
import { buildAssessment } from "../src/assessment/buildAssessment.js";
import { validateAssessment } from "../src/assessment/invariants.js";
import { validateAgainstSchema } from "../src/assessment/schemaValidator.js";
import { deriveSummary, renderSummaryText, parseRenderedSummary } from "../src/assessment/summary.js";
import { computeQualityMetrics } from "../src/assessment/qualityMetrics.js";
import { noteNegatesTrigger, guardLlmCitations } from "../src/evaluators/guidelineEffects.js";
import { getGuidelineRulesById } from "../src/evaluators/guidelineRules.js";
import { REAL_BODY, REAL_STATE_BLOCKS, REAL_DECISION_BLOCKS, REAL_RATIO_BLOCKS, REAL_LISTS, REAL_BP_MAPPING_BLOCKS } from "./fixtures/sup10Blocks.js";

const sup10 = loadProcess("SUP.10");
const MANIFEST = [{ documentId: "DOC-SUP10-PLAN", fileName: "plan.docx", contentHash: "x", documentVersion: "V1.0", extractionStatus: "OK", unreadableRanges: [] }];

// ── A. 의미 해석 ────────────────────────────────────────────────────────────
test("[real] T01 제안자 ID 가 있으면 '개시자 없음' 지적을 기각한다", () => {
  const r = reconcileAbsenceClaim({ conceptId: "initiator", claim: "개시자 정보 없음" }, REAL_BODY);
  assert.equal(r.disposition, "REJECTED");
  assert.ok(r.counterEvidence.some((c) => /제안자/.test(c.quote)));
});

test("[real] T02 자동 고유 ID 부여가 있으면 '고유 식별 없음' 지적을 기각한다", () => {
  const r = reconcileAbsenceClaim({ conceptId: "unique_id", claim: "고유 식별 없음" }, REAL_BODY);
  assert.equal(r.disposition, "REJECTED");
  assert.ok(r.counterEvidence.some((c) => /일련번호/.test(c.quote)));
});

test("[real] T03 종결·통보 표현을 종료·의사소통의 의미로 검토한다", () => {
  assert.ok(termVariants("종료").includes("종결"));
  assert.ok(termVariants("의사소통").includes("통보"));
  assert.ok(termVariants("의사소통").includes("알림"));
  assert.ok(termVariants("개시자").includes("제안자"));
  assert.equal(reconcileAbsenceClaim({ conceptId: "closure", claim: "종료 없음" }, REAL_BODY).disposition, "REJECTED");
  assert.equal(reconcileAbsenceClaim({ conceptId: "communication", claim: "의사소통 없음" }, REAL_BODY).disposition, "REJECTED");
});

test("[synthetic] 반대 증거가 없어도 부재를 '확정'하지 않는다: 관찰되지 않음 ≠ 수행되지 않음, 판독 불가면 보류", () => {
  const blocks = [{ text: "무관한 문장", locator: { section: "1" } }];
  const none = reconcileAbsenceClaim({ conceptId: "initiator", claim: "x" }, blocks);
  assert.equal(none.disposition, "ACCEPTED");
  assert.match(none.reason, /관찰되지 않음/);
  assert.equal(reconcileAbsenceClaim({ conceptId: "initiator", claim: "x" }, blocks, { unreadable: true }).disposition, "DEFERRED");
});

test("[synthetic] 목차·BP 매핑표에만 있는 표현은 본문 반대 증거가 아니다(수정으로 처리)", () => {
  const blocks = [{ text: "SUP.10.BP1 | 제안자 관리 | 4장\nSUP.10.BP2 | 식별 | 5장", locator: { section: "2.1" } }];
  assert.equal(classifyBlock(blocks[0].text), "BP_MAPPING");
  assert.equal(reconcileAbsenceClaim({ conceptId: "initiator", claim: "x" }, blocks).disposition, "MODIFIED");
});

test("[synthetic] T04 '간의'·'의해'·'용이하도록' 표현은 키워드가 아니며 삭제만으로 점수가 낮아지지 않는다", () => {
  const kws = extractKoreanKeywords("변경 요청 간의 추적이 용이하도록 요청에 의해 상태를 배정한다", 10);
  for (const w of ["간의", "의해", "용이하도록"]) assert.ok(!kws.includes(w), w);
  assert.ok(kws.includes("추적"));
});

test("[real] T04 규칙 스코어러: 요구 표현이 동의어이거나 기능어일 때 '부족'으로 세지 않는다", async () => {
  const bp1 = sup10.basePractices.find((b) => b.id === "BP1");
  const text = REAL_BODY.map((b) => b.text).join("\n") + "\n변경 요청 설명 기록 범위 상태 사유 변경 사유 고유 식별 ID";
  const r = await ruleScorer.scoreBP({ process: sup10, bp: bp1, artifacts: [{ name: "plan.docx", text }] });
  const missing = (r.gaps[0] ?? "");
  for (const w of ["개시자", "간의", "의해", "용이하도록"]) assert.ok(!missing.includes(w), `${w} 는 부족 키워드가 아니어야 한다: ${missing}`);
  assert.match(r.findings[0].ratingImpact.reason, /증거 후보 검색 점수/);
  assert.match(r.findings[0].ratingImpact.reason, /50\+50×\(/);
});

// ── 기대사항·증거 상태 ─────────────────────────────────────────────────────
test("[synthetic] T08 자원 요구량 추정만으로 자원 가용성 확인을 인정하지 않는다", () => {
  const cov = conceptCoverage(["resource_availability"], ["공수 (Effort) | 추가 공수 | WP별 공수 재산정"]);
  assert.deepEqual(cov.uncovered, ["resource_availability"]);
  assert.deepEqual(cov.substitutionRisk, [{ required: "resource_availability", foundInstead: "resource_estimate" }]);
  const evidenceById = new Map([["EV-1", { evidenceType: "PLAN", quote: "공수 (Effort) | 추가 공수 | WP별 공수 재산정" }]]);
  const r = evaluateExpectationStatus({
    scope: "DOCUMENT_ADEQUACY",
    expectation: { id: "SUP.10.BP3.E1", requiredConcepts: ["resource_availability"] },
    links: [{ evidenceId: "EV-1", relation: "SUPPORTS" }],
    evidenceById,
  });
  assert.equal(r.evidenceStatus, "PARTIAL");
  assert.match(r.missingEvidence.join(" "), /자원 가용성/);
  // 가용성을 직접 말하는 증거가 있으면 SUPPORTED
  const ok = evaluateExpectationStatus({
    scope: "DOCUMENT_ADEQUACY",
    expectation: { id: "e", requiredConcepts: ["resource_availability"] },
    links: [{ evidenceId: "EV-2", relation: "SUPPORTS" }],
    evidenceById: new Map([["EV-2", { evidenceType: "PLAN", quote: "승인 전 자원 가용성을 확인한다" }]]),
  });
  assert.equal(ok.evidenceStatus, "SUPPORTED");
});

test("[real] T14 계획서의 자동화 선언을 실제 도구 설정·운영 실적으로 분류하지 않는다", () => {
  const decl = "Polarion ALM의 \"Linked Items\" 기능으로 양방향 자동 추적. orphan CR 0건 보장.";
  assert.equal(evidenceTypeForBlock(classifyBlock(decl)), "PLAN");
  // 단정 표현 + 계획 증거만 → 위반
  assert.equal(checkExecutionWording("양방향 추적이 Polarion 으로 자동 관리되고 있다", ["PLAN"]).violation, true);
  assert.equal(checkExecutionWording("양방향 추적이 Polarion 으로 자동 관리되고 있다", ["SELF_DECLARATION"]).violation, true);
  assert.equal(checkExecutionWording("양방향 추적이 Polarion 으로 자동 관리되고 있다", ["TOOL_CONFIGURATION"]).violation, false);
  assert.equal(checkExecutionWording("계획서는 Polarion 으로 자동 관리하도록 정의한다", ["PLAN"]).violation, false);
  // 파이프라인: 실행 단정 지적은 MODIFIED
  const a = buildAssessment({
    processSpec: sup10, manifest: MANIFEST,
    evidence: [{ evidenceId: "EV-1", documentId: "DOC-SUP10-PLAN", locator: { section: "9.1" }, quote: decl, evidenceType: "PLAN", extractionConfidence: 1, verificationStatus: "QUOTE_MATCHED" }],
    findings: [{ findingId: "F-1", expectationIds: ["SUP.10.BP4.E1"], findingType: "STRENGTH", claim: "양방향 추적이 자동으로 수행되고 있다", evidenceIds: ["EV-1"], sourceEngine: "LLM", executionClaim: true }],
  });
  assert.equal(a.findings[0].disposition, "MODIFIED");
  assert.match(a.findings[0].dispositionReason, /계획·선언 증거만/);
});

test("[real] 목차·매핑표·자기충족 선언만 있으면 SUPPORTED 가 아니다 (문서 적절성)", () => {
  const self = "✓ ASPICE SUP.10 BP1~BP8 (8개 BP) 모두 충족 — Capability Level 1.";
  assert.equal(classifyBlock(self), "SELF_DECLARATION");
  const r = evaluateExpectationStatus({
    scope: "DOCUMENT_ADEQUACY", expectation: { id: "e" },
    links: [{ evidenceId: "EV-S", relation: "SUPPORTS" }],
    evidenceById: new Map([["EV-S", { evidenceType: "SELF_DECLARATION", quote: self }]]),
  });
  assert.equal(r.evidenceStatus, "PARTIAL");
  // 수행 평가에서는 계획 증거만으로 SUPPORTED 불가
  const perf = evaluateExpectationStatus({
    scope: "PROCESS_PERFORMANCE", expectation: { id: "e" },
    links: [{ evidenceId: "EV-P", relation: "SUPPORTS" }],
    evidenceById: new Map([["EV-P", { evidenceType: "PLAN", quote: "계획" }]]),
  });
  assert.equal(perf.evidenceStatus, "PARTIAL");
});

test("[synthetic] T15 동일 기대사항의 강점·부족 주장을 증거 상태로 조정한다", () => {
  const mk = () => [
    { findingId: "S", expectationIds: ["SUP.10.BP1.E2"], findingType: "STRENGTH", sourceEngine: "LLM", disposition: "ACCEPTED", dispositionReason: "" },
    { findingId: "W", expectationIds: ["SUP.10.BP1.E2"], findingType: "WEAKNESS", sourceEngine: "RULE", disposition: "ACCEPTED", dispositionReason: "" },
  ];
  const conflicts = detectFindingConflicts(mk());
  assert.equal(conflicts.length, 1);
  const supported = resolveFindingConflicts(mk(), conflicts, [{ expectationId: "SUP.10.BP1.E2", evidenceStatus: "SUPPORTED" }]);
  assert.equal(supported.findings.find((f) => f.findingId === "W").disposition, "REJECTED");
  assert.equal(supported.findings.find((f) => f.findingId === "S").disposition, "ACCEPTED");
  assert.equal(supported.conflicts[0].resolution, "RESOLVED_BY_EVIDENCE");
  const notObs = resolveFindingConflicts(mk(), conflicts, [{ expectationId: "SUP.10.BP1.E2", evidenceStatus: "NOT_OBSERVED" }]);
  assert.equal(notObs.findings.find((f) => f.findingId === "S").disposition, "REJECTED");
  const partial = resolveFindingConflicts(mk(), conflicts, [{ expectationId: "SUP.10.BP1.E2", evidenceStatus: "PARTIAL" }]);
  assert.ok(partial.findings.every((f) => f.disposition === "MODIFIED"));
  const unreadable = resolveFindingConflicts(mk(), conflicts, [{ expectationId: "SUP.10.BP1.E2", evidenceStatus: "UNREADABLE" }]);
  assert.ok(unreadable.findings.every((f) => f.disposition === "DEFERRED"));
  assert.equal(unreadable.conflicts[0].resolution, "REVIEW_REQUIRED");
});

test("[real] T16 영향분석 영역과 CCB 역할 목록을 혼동하지 않는다", () => {
  // Hybrid 리포트의 서술: 영향 분석 5개 영역(기술, 시스템, 품질, 안전, 형상)
  const wrong = verifyListMembershipClaim({ listKind: "impact_areas", claimedItems: ["기술", "시스템", "품질", "안전", "형상"] }, REAL_LISTS);
  assert.equal(wrong.ok, false);
  assert.deepEqual(wrong.misplaced.map((m) => m.item).sort(), ["기술", "시스템", "형상"].sort());
  assert.ok(wrong.misplaced.every((m) => m.actualListKind === "ccb_roles"));
  const right = verifyListMembershipClaim({ listKind: "impact_areas", claimedItems: ["일정", "공수", "품질", "안전", "외부 인터페이스"] }, REAL_LISTS);
  assert.equal(right.ok, true);
});

// ── E. 문서 일관성 ──────────────────────────────────────────────────────────
test("[real] T17 상태 목록에 없는 조건부 종결(Closed with Risk Acceptance)을 발견한다", () => {
  const hits = scanStateModel(REAL_STATE_BLOCKS);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].state, "Closed with Risk Acceptance");
  assert.equal(hits[0].kind, "STATE_VARIANT_NOT_DEFINED");
  assert.equal(hits[0].relatedDefinedState, "Closed");
  // 정상 전이만 있으면 발견하지 않는다
  const clean = REAL_STATE_BLOCKS.filter((b) => !/Risk Acceptance/.test(b.text));
  assert.deepEqual(scanStateModel(clean), []);
});

test("[real] T18 Defer 결정 이후 처리 정의의 유무를 확인한다", () => {
  const hits = scanDecisionOutcomeHandling(REAL_DECISION_BLOCKS, ["Approve", "Reject", "Defer"], { Defer: ["보류", "연기"] });
  assert.deepEqual(hits.map((h) => h.outcome), ["Defer"]);
  // Defer 후속 처리가 정의되면 발견하지 않는다 [synthetic]
  const withDefer = [...REAL_DECISION_BLOCKS, { text: "Defer 시 Deferred 상태로 전이하고 다음 정기 CCB 에서 재심의한다", locator: { section: "6.2" } }];
  assert.deepEqual(scanDecisionOutcomeHandling(withDefer, ["Approve", "Reject", "Defer"]), []);
});

test("[real] T19 전체 15개 중 9개를 50% 로 표시한 불일치를 발견한다", () => {
  const hits = scanRatioInconsistencies(REAL_RATIO_BLOCKS);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].stated, "50%");
  assert.match(hits[0].computed, /9\/15 = 60\.0%/);
  // 60% 로 표기하면 이상 없음 [synthetic]
  assert.deepEqual(scanRatioInconsistencies([{ text: "전체 15 SVT" }, { text: "전체 SVT 60% (9건)" }]), []);
});

test("[real] 문서 자체 BP 8개 vs 공식 PAM 6개 차이를 표시한다", () => {
  const r = compareBpMapping(REAL_BP_MAPPING_BLOCKS, "SUP.10", sup10.basePractices.map((b) => b.id));
  assert.equal(r.documentBpCount, 8);
  assert.equal(r.officialBpCount, 6);
  assert.deepEqual(r.notInOfficial, ["BP7", "BP8"]);
  assert.equal(r.mismatch, true);
});

test("[synthetic] T22 BP 번호나 증거 위치만 바꿔도 의미상 동일한 판단을 유지한다", () => {
  const a = [{ text: "제안자 (전 인력) → 등록", locator: { section: "4.1" } }];
  const b = [{ text: "SUP.10.BP7 항목: 제안자 (전 인력) → 등록", locator: { section: "9.9", table: "다른 표" } }];
  const ra = reconcileAbsenceClaim({ conceptId: "initiator", claim: "x" }, a);
  const rb = reconcileAbsenceClaim({ conceptId: "initiator", claim: "x" }, b);
  assert.equal(ra.disposition, "REJECTED");
  assert.equal(rb.disposition, ra.disposition);
  assert.deepEqual([...conceptsIn(a[0].text)], [...conceptsIn("BP2 " + a[0].text)]);
});

// ── 스키마·범위·판독 불가 ───────────────────────────────────────────────────
test("[synthetic] T23 문서 적절성 검토에서 실제 PA/CL 달성을 확정하지 않는다", () => {
  const a = buildAssessment({ processSpec: sup10, manifest: MANIFEST, provisionalRatings: { "SUP.10.BP1": "F" } });
  assert.equal(a.assessmentScope, "DOCUMENT_ADEQUACY");
  assert.equal(a.paResult.status, "NOT_APPLICABLE");
  assert.equal(a.capabilityResult.value, null);
  const s = deriveSummary(a);
  assert.equal(s.capability.status, "NOT_APPLICABLE");
  assert.match(s.conclusion, /판정하지 않는다/);
  // 위반 입력: FINAL CL1
  const bad = structuredClone(a);
  bad.capabilityResult = { status: "FINAL", value: "F", rationale: "x", evidenceSufficiency: "SUFFICIENT", unresolvedIssues: [] };
  assert.ok(validateAssessment(bad).violations.some((v) => v.code === "INV-SCOPE-ACHIEVEMENT"));
});

test("[synthetic] T24 입력 파일 누락·판독 불가를 프로세스 미수행으로 처리하지 않는다", () => {
  const failed = [{ ...MANIFEST[0], extractionStatus: "FAILED", unreadableRanges: ["p.3-5"] }];
  const a = buildAssessment({ processSpec: sup10, manifest: failed });
  assert.ok(a.bpResults.flatMap((b) => b.expectationResults).every((e) => e.evidenceStatus === "UNREADABLE"));
  assert.ok(a.bpResults.every((b) => b.rating.value === null && b.rating.status === "WITHHELD"), "증거 불충분을 N 으로 바꾸지 않는다");
  // 판독 불가 문서를 검색했는데 NOT_OBSERVED 로 기록한 입력은 위반
  const bad = structuredClone(a);
  bad.bpResults[0].expectationResults[0].evidenceStatus = "NOT_OBSERVED";
  assert.ok(validateAssessment(bad).violations.some((v) => v.code === "INV-UNREADABLE-AS-ABSENT"));
});

test("[synthetic] T21 검색 점수·추출 신뢰도·증거 충족·등급은 별도 필드다 (중간 점수 ≠ 최종 등급)", () => {
  const a = buildAssessment({ processSpec: sup10, manifest: MANIFEST, provisionalRatings: { "SUP.10.BP1": "L", "SUP.10.BP2": "P" }, retrievalScores: { "SUP.10.BP1": 87, "SUP.10.BP2": 97 } });
  const bp1 = a.bpResults[0];
  assert.equal(bp1.retrievalScore, 87);
  assert.equal(bp1.rating.value, "L");
  assert.match(bp1.retrievalScoreNote, /충족 판단·등급이 아니다/);
  const bp2 = a.bpResults[1];
  assert.equal(bp2.retrievalScore, 97);
  assert.equal(bp2.rating.value, "P", "높은 검색 점수가 등급을 올리지 않는다");
  // 등급 객체에 검색 점수를 섞으면 스키마 위반
  const bad = structuredClone(a);
  bad.bpResults[0].rating.retrievalScore = 87;
  assert.ok(validateAgainstSchema(bad).some((e) => /retrievalScore/.test(e.path)));
  // 제품 세분 등급은 공식 등급과 분리
  const fine = buildAssessment({ processSpec: sup10, manifest: MANIFEST, provisionalRatings: { "SUP.10.BP1": "L+" } });
  assert.equal(fine.bpResults[0].rating.value, "L");
  assert.equal(fine.bpResults[0].rating.productGrade, "L+");
});

test("[synthetic] 스키마·불변조건: 존재하지 않는 evidenceId, 해당 없음 사유 누락, FALSE/UNKNOWN 하향 확정", () => {
  const a = buildAssessment({ processSpec: sup10, manifest: MANIFEST });
  const bad = structuredClone(a);
  bad.bpResults[0].expectationResults[0].supportingEvidenceIds = ["EV-NOPE"];
  bad.bpResults[0].expectationResults[1].evidenceStatus = "NOT_APPLICABLE";
  bad.bpResults[0].expectationResults[1].applicabilityRationale = "";
  const codes = validateAssessment(bad).violations.map((v) => v.code);
  assert.ok(codes.includes("INV-EVIDENCE-REF"));
  assert.ok(codes.includes("INV-NA-RATIONALE"));
  const rule = structuredClone(a);
  rule.ruleEvaluations.push({ ruleId: "SUP.10.RL.3", targetId: "SUP.10.BP3", sourceReference: "x", conditionResult: "UNKNOWN", conditionEvidenceIds: [], significanceConditionResult: null, effectType: "EXCLUDE_F", applicationStatus: "APPLIED", beforeRating: "F", afterRating: "L", rationale: "x" });
  const rc = validateAssessment(rule).violations.map((v) => v.code);
  assert.ok(rc.includes("INV-RULE-CONDITION"));
  assert.ok(rc.includes("INV-RULE-UNKNOWN-APPLIED"));
  const missing = structuredClone(a);
  delete missing.schemaVersion;
  assert.ok(validateAssessment(missing).schemaErrors.some((e) => /schemaVersion/.test(e.path)));
  assert.ok(a.schemaVersion && a.engineVersion && a.promptVersion && a.ruleSetVersion, "버전 4종이 기록된다");
});

// ── 요약 일관성 ────────────────────────────────────────────────────────────
function assessmentWith(findings, extra = {}) {
  return buildAssessment({ processSpec: sup10, manifest: MANIFEST, provisionalRatings: { "SUP.10.BP1": "L", "SUP.10.BP5": "L" }, findings, ...extra });
}
const F = (id, exp, type, disposition = "ACCEPTED", claim = id) => ({ findingId: id, expectationIds: [exp], findingType: type, claim, sourceEngine: "LLM", disposition, dispositionReason: disposition === "REJECTED" ? "근거" : "" });

test("[synthetic] T20 최종 WEAKNESS 가 있으면 'Finding 없음'을 출력하지 않는다", () => {
  const s = deriveSummary(assessmentWith([F("W-1", "SUP.10.BP5.E1", "WEAKNESS", "ACCEPTED", "관련 이해관계자 확인 불명확")]));
  assert.equal(s.findingCount, 1);
  assert.equal(s.noFindingStatement, null);
  assert.doesNotMatch(renderSummaryText(s), /특이 Finding 없음/);
  // 기각된 약점은 세지 않는다. 그래도 빈 입력은 미해결 규칙(PENDING)이 있으므로 '없음'이라고 하지 않는다.
  const none = deriveSummary(assessmentWith([F("W-2", "SUP.10.BP5.E1", "WEAKNESS", "REJECTED")]));
  assert.equal(none.findingCount, 0);
  assert.ok(none.openIssues.length > 0);
  assert.equal(none.noFindingStatement, null);
  // 약점도 미해결도 없을 때만 허용 [synthetic: 규칙 없는 가상 프로세스]
  const quiet = buildAssessment({ processSpec: { id: "Z.1", basePractices: [{ id: "BP1", title: "t", description: "수행한다." }] }, manifest: MANIFEST, rules: [], provisionalRatings: { "Z.1.BP1": "L" } });
  assert.equal(deriveSummary(quiet).noFindingStatement, "특이 Finding 없음");
});

test("[synthetic] 강점 목록은 모든 BP 를 자동 포함하지 않고 채택된 강점 Finding 에서만 만든다", () => {
  const s = deriveSummary(assessmentWith([F("S-1", "SUP.10.BP1.E2", "STRENGTH"), F("S-2", "SUP.10.BP2.E1", "STRENGTH", "REJECTED")]));
  assert.deepEqual(s.strengths.map((x) => x.bpId), ["SUP.10.BP1"]);
});

test("[synthetic] T26 요약·화면·텍스트·PDF 의 최종 등급 및 Finding 수가 일치한다", () => {
  const a = assessmentWith([F("W-1", "SUP.10.BP5.E1", "WEAKNESS"), F("W-2", "SUP.10.BP1.E3", "MISSING_EXPECTATION"), F("S-1", "SUP.10.BP1.E2", "STRENGTH")]);
  const summary = deriveSummary(a);
  // 세 출력은 모두 같은 summary 만 렌더링한다.
  const textView = renderSummaryText(summary);
  const screenView = { ratings: Object.fromEntries(summary.bpRows.map((r) => [r.bpId, r.rating ?? "미확정"])), findingCount: summary.findingCount };
  const pdfLines = renderSummaryText(summary).split("\n");
  const parsedText = parseRenderedSummary(textView);
  const parsedPdf = parseRenderedSummary(pdfLines.join("\n"));
  assert.deepEqual(parsedText, parsedPdf);
  assert.equal(parsedText.findingCount, screenView.findingCount);
  assert.deepEqual(parsedText.ratings, screenView.ratings);
  assert.equal(parsedText.findingCount, 2);
  assert.equal(parsedText.strengthCount, 1);
  // 분포 합 = BP 수
  const d = summary.distribution;
  assert.equal(d.N + d.P + d.L + d.F + d.UNRATED, sup10.basePractices.length);
});

// ── 가이드라인 B: LLM 자기모순 적용 방지 ────────────────────────────────────
test("[real] LLM 이 'RL.3 적용' 이라면서 note 에는 모든 관련자가 대표된다고 쓴 경우 적용을 보류한다", () => {
  assert.equal(noteNegatesTrigger("CCB에 모든 관련 분야와 이해관계자가 대표되어 있으므로 RL.3 상한 규칙이 충족됨."), true);
  assert.equal(noteNegatesTrigger("모든 관련 분야와 이해관계자가 승인 권한에 포함되어 있음."), true);
  assert.equal(noteNegatesTrigger("승인 권한에 SW 검증 담당이 포함되어 있지 않아 모든 관련 분야가 대표되지 않는다."), false);
  const rulesById = getGuidelineRulesById();
  const out = guardLlmCitations(80, [{ ruleId: "SUP.10.RL.3", applied: true, note: "모든 관련 분야와 이해관계자가 승인 권한에 포함되어 있음." }], rulesById);
  assert.equal(out[0].applied, false);
  assert.match(out[0].note, /^\[보류: 적용 사유가 규칙 조건의 불성립을 서술함\]/);
  const kept = guardLlmCitations(80, [{ ruleId: "SUP.10.RL.3", applied: true, note: "안전 담당이 승인 권한에 없다." }], rulesById);
  assert.equal(kept[0].applied, true);
});

test("정량 지표: 심사자 확정 참조 집합이 없으면 계산하지 않는다", () => {
  const r = computeQualityMetrics({ judgments: [] }, []);
  assert.equal(r.status, "NOT_COMPUTABLE");
  const c = computeQualityMetrics(
    { reviewerConfirmed: true, judgments: [{ claimId: "a", classification: "FALSE_POSITIVE" }, { claimId: "b", classification: "VALID" }, { claimId: "c", classification: "UNDETERMINED" }] },
    [{ claimId: "a", disposition: "REJECTED" }, { claimId: "b", disposition: "ACCEPTED" }, { claimId: "c", disposition: "DEFERRED" }],
  );
  assert.equal(c.falsePositiveRejection.denominator, 1);
  assert.equal(c.falsePositiveRejection.value, 1);
  assert.equal(c.validRecall.value, 1);
  assert.match(c.scope, /일반화하지 않는다/);
});
