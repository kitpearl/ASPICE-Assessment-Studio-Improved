// 구조화 평가 파이프라인 (프로세스 비종속).
//  1 기대사항 정규화 → 2 증거 후보 검색 → 3 의미 기반 증거 판정(입력) → 4 부재 주장 반대 증거 검색 →
//  5 문서 내부 일관성 → 6 지적 충돌 해결 → 7 잠정 평가 → 8 조건부 규칙 적용 → 9 BP 간 의존성 재검사(고정점) →
//  10 최종 일관성 검증 → 11 같은 최종 데이터에서 출력 생성(summary.js)
// 의미 판정(3단계)과 잠정 등급(7단계)은 LLM·심사자가 만든 구조화 입력을 받는다. 이 모듈이 키워드로 결함을 판정하지 않는다.
import { createHash } from "node:crypto";
import { loadGuideline } from "../../spec/canonical/index.js";
import {
  SCHEMA_VERSION, ENGINE_VERSION, RULE_LOGIC_VERSION, PROMPT_VERSION_NONE,
} from "./constants.js";
import { normalizeExpectations, searchEvidenceCandidates } from "./expectations.js";
import {
  classifyBlock, evidenceTypeForBlock, evaluateExpectationStatus, reconcileAbsenceClaim,
  detectFindingConflicts, resolveFindingConflicts, checkExecutionWording,
} from "./evidenceReasoning.js";
import { scanRatioInconsistencies, scanStateModel, scanDecisionOutcomeHandling, compareBpMapping } from "./documentChecks.js";
import { evaluateRules } from "./ruleEngine.js";
import { validateAssessment } from "./invariants.js";
import { bpOfExpectation } from "./summary.js";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** @param {{fileName: string, content?: string|Buffer, contentHash?: string, documentVersion?: string|null, extractionStatus?: string, unreadableRanges?: string[], documentId?: string}} d */
export function manifestEntry(d) {
  return {
    documentId: d.documentId ?? `DOC-${sha256(d.fileName).slice(0, 8)}`,
    fileName: d.fileName,
    contentHash: d.contentHash ?? (d.content != null ? sha256(d.content) : null),
    documentVersion: d.documentVersion ?? null,
    extractionStatus: d.extractionStatus ?? "OK",
    unreadableRanges: d.unreadableRanges ?? [],
  };
}

const evidenceIdFor = (documentId, i) => `EV-${documentId.replace(/^DOC-/, "")}-${String(i + 1).padStart(3, "0")}`;

/**
 * @param {object} input 문서 상단 주석과 test/assessmentPipeline.test.js 참조
 */
export function buildAssessment(input) {
  const {
    processSpec,
    scope = "DOCUMENT_ADEQUACY",
    assessmentId = `ASM-${processSpec.id}-${Date.now()}`,
    supersedes = null,
    manifest = [],
    blocks = [],
    evidence: givenEvidence = [],
    expectationLinks = {},
    expectationOverrides = {},
    findings: inputFindings = [],
    provisionalRatings = {},
    retrievalScores = {},
    conditionInputs = {},
    reviewerDecisions = {},
    externalRatings = {},
    priorEvaluations = [],
    decisionOutcomes = null,
    versions = {},
    rules = loadGuideline().rules ?? [],
    paResult = null,
    capabilityResult = null,
  } = input;

  const processId = processSpec.id;
  const guideline = loadGuideline();

  // ── 증거 풀: 주어진 증거 + 블록에서 자동 생성한 증거 ──────────────────────────
  const evidence = [...givenEvidence];
  const blockEvidence = new Map();
  const ensureBlockEvidence = (b, i) => {
    if (b.evidenceId) return b.evidenceId;
    if (blockEvidence.has(b)) return blockEvidence.get(b);
    const documentId = b.documentId ?? manifest[0]?.documentId ?? "DOC-UNKNOWN";
    const kind = b.blockKind ?? classifyBlock(b.text);
    const id = evidenceIdFor(documentId, i);
    blockEvidence.set(b, id);
    if (!evidence.some((e) => e.evidenceId === id)) {
      evidence.push({
        evidenceId: id,
        documentId,
        locator: { page: null, section: null, table: null, paragraph: null, cell: null, ...(b.locator ?? {}) },
        quote: String(b.text).trim().slice(0, 600),
        evidenceType: b.evidenceType ?? evidenceTypeForBlock(kind, { isTemplate: b.isTemplate }),
        extractionConfidence: b.extractionConfidence ?? null,
        verificationStatus: "UNVERIFIED",
      });
    }
    b.evidenceId = id;
    return id;
  };
  const workBlocks = blocks.map((b) => ({ ...b }));
  workBlocks.forEach((b, i) => { b.blockKind = b.blockKind ?? classifyBlock(b.text); b._i = i; });
  const evidenceById = new Map();
  const refreshIndex = () => { evidenceById.clear(); for (const e of evidence) evidenceById.set(e.evidenceId, e); };
  refreshIndex();

  // ── 1) 기대사항 정규화 ────────────────────────────────────────────────────
  const expectations = input.expectations ?? normalizeExpectations(processSpec);

  // ── 2~3) 증거 후보 검색 + 의미 판정 입력 → 기대사항 증거 상태 ───────────────────
  const searchedDocs = manifest;
  const expectationResults = expectations.map((ex) => {
    const ov = expectationOverrides[ex.expectationId] ?? {};
    const links = expectationLinks[ex.expectationId] ?? [];
    const base = evaluateExpectationStatus({
      scope,
      expectation: { id: ex.expectationId, applicable: ov.applicable, applicabilityRationale: ov.applicabilityRationale },
      links,
      evidenceById,
      searchedDocs,
    });
    let rationale = ov.rationale ?? "";
    if (!links.length && base.evidenceStatus !== "NOT_APPLICABLE" && workBlocks.length) {
      const cands = searchEvidenceCandidates(ex, workBlocks).filter((c) => c.blockKind === "BODY");
      if (cands.length) {
        // 검색 후보만 있고 의미 판정이 없다 — 충족도 부재도 확정하지 않는다.
        base.evidenceStatus = "PARTIAL";
        base.missingEvidence = [`의미 판정(LLM·심사자) 필요: 후보 ${cands.length}건 (검색 순위는 충족 판단이 아님)`];
        rationale = rationale || "후보 블록은 찾았으나 의미 판정 입력이 없어 충족 여부를 확정하지 않았다.";
      }
    }
    return {
      expectationId: ex.expectationId,
      normativeReference: ex.normativeReference,
      searchedDocumentIds: searchedDocs.map((d) => d.documentId),
      ...base,
      missingEvidence: [...base.missingEvidence, ...(ov.missingEvidence ?? [])],
      rationale: rationale || `${ex.textKo}`,
    };
  });

  // ── 4) 부재 주장에 대한 반대 증거 검색 + 실행 표현 점검 ──────────────────────
  const unreadable = manifest.some((d) => d.extractionStatus !== "OK");
  const findings = inputFindings.map((f) => {
    const out = {
      findingId: f.findingId,
      ...(f.bpId ? { bpId: f.bpId } : {}),
      expectationIds: f.expectationIds ?? [],
      findingType: f.findingType,
      claim: f.claim ?? "",
      evidenceIds: [...(f.evidenceIds ?? [])],
      rootCauseId: f.rootCauseId ?? null,
      significanceRationale: f.significanceRationale ?? "",
      sourceEngine: f.sourceEngine,
      disposition: f.disposition ?? "ACCEPTED",
      dispositionReason: f.dispositionReason ?? "",
    };
    if (f.absenceClaim && workBlocks.length) {
      const r = reconcileAbsenceClaim(f.absenceClaim, workBlocks.map((b) => ({ ...b, evidenceId: ensureBlockEvidence(b, b._i) })), { unreadable });
      out.disposition = r.disposition;
      out.dispositionReason = r.reason;
      if (f.conservativeAbsence && r.disposition === "REJECTED") {
        // 지적 문장이 정말 "부재" 주장인지 자동으로 확신할 수 없는 경우(LLM 서술): 기각하지 않고 보류한다.
        out.disposition = "DEFERRED";
        out.dispositionReason = `반대 증거 후보가 있어 심사자 확인이 필요하다. ${r.reason}`;
      }
      if (r.counterEvidence.length) out.evidenceIds = [...new Set([...out.evidenceIds, ...r.counterEvidence.map((c) => c.evidenceId).filter(Boolean)])];
    }
    if (f.executionClaim) {
      refreshIndex();
      const types = out.evidenceIds.map((id) => evidenceById.get(id)?.evidenceType).filter(Boolean);
      const w = checkExecutionWording(out.claim, types);
      if (w.violation) {
        out.disposition = "MODIFIED";
        out.dispositionReason = `계획·선언 증거만으로 수행을 단정했다. ${w.suggestion}`;
      }
    }
    return out;
  });
  refreshIndex();

  // ── 5) 문서 내부 일관성 ──────────────────────────────────────────────────
  const consistencyChecks = [];
  const bodyBlocks = workBlocks.map((b) => ({ text: b.text, locator: b.locator }));
  const pushCheck = (checkId, hits, label) => {
    consistencyChecks.push({
      checkId,
      status: hits.length ? "REVIEW" : "PASS",
      detail: hits.length ? `${label}: ${hits.length}건` : `${label}: 이상 없음`,
      items: hits,
    });
  };
  if (workBlocks.length) {
    pushCheck("DOC-RATIO-MISMATCH", scanRatioInconsistencies(bodyBlocks), "수치·비율 불일치");
    pushCheck("DOC-STATE-MODEL", scanStateModel(bodyBlocks), "상태 정의·전이 불일치");
    if (decisionOutcomes?.length) pushCheck("DOC-DECISION-OUTCOME", scanDecisionOutcomeHandling(bodyBlocks, decisionOutcomes, input.decisionAliases ?? {}), "결정 결과 후속 처리 누락");
    const map = compareBpMapping(bodyBlocks, processId, (processSpec.basePractices ?? []).map((b) => b.id));
    consistencyChecks.push({
      checkId: "DOC-BP-MAPPING",
      status: map.mismatch ? "REVIEW" : "PASS",
      detail: map.mismatch ? `문서 자체 BP ${map.documentBpCount}개 vs 공식 PAM ${map.officialBpCount}개 — 의미 기반 대응 필요` : "문서 BP 구성이 공식 구성과 같다",
      items: [map],
    });
  }

  // ── 6) 지적 충돌 해결 ────────────────────────────────────────────────────
  const conflicts = detectFindingConflicts(findings);
  const resolved = resolveFindingConflicts(findings, conflicts, expectationResults);
  const finalFindings = resolved.findings;

  // ── 7) 잠정 평가 → BP 키 ─────────────────────────────────────────────────
  const provisional = {};
  for (const bp of processSpec.basePractices ?? []) {
    const key = `${processId}.${bp.id}`;
    if (key in provisionalRatings) provisional[key] = provisionalRatings[key];
  }
  for (const k of Object.keys(provisionalRatings)) if (!(k in provisional)) provisional[k] = provisionalRatings[k]; // PA 키 등

  // ── 8~9) 조건부 규칙 적용 + 의존성 고정점 ─────────────────────────────────
  const engine = evaluateRules({ processSpec, rules, provisional, conditionInputs, reviewerDecisions, externalRatings, priorEvaluations });
  conflicts.length = 0;
  conflicts.push(...resolved.conflicts, ...engine.conflicts);

  const bpResults = (processSpec.basePractices ?? []).map((bp) => {
    const key = `${processId}.${bp.id}`;
    const exps = expectationResults.filter((r) => bpOfExpectation(r.expectationId) === key);
    const rr = engine.ratings[key];
    const statuses = exps.map((e) => e.evidenceStatus).filter((s) => s !== "NOT_APPLICABLE");
    const sufficiency = !statuses.length ? "NOT_ASSESSED"
      : statuses.every((s) => s === "SUPPORTED") ? "SUFFICIENT"
      : statuses.some((s) => s === "NOT_OBSERVED" || s === "UNREADABLE" || s === "CONTRADICTED") ? "INSUFFICIENT"
      : "PARTIAL";
    const unresolved = [...(rr?.unresolvedIssues ?? [])];
    for (const e of exps) if (e.evidenceStatus === "UNREADABLE") unresolved.push(`${e.expectationId}: 판독 불가 범위 때문에 판단 보류`);
    const hasProvisional = rr && rr.provisional != null;
    const rating = {
      status: hasProvisional ? rr.status : "WITHHELD",
      value: hasProvisional ? rr.value : null,
      productGrade: rr?.productGrade ?? null,
      rationale: hasProvisional
        ? `임시 등급 ${rr.provisional}${rr.appliedRuleIds.length ? ` → 규칙 ${rr.appliedRuleIds.join(", ")} 적용 후 ${rr.value ?? "보류"}` : ""}. 증거 충족도 ${sufficiency}.`
        : "임시 등급이 제공되지 않아 등급을 제시하지 않는다(검색 점수·증거 충족 상태에서 등급을 자동 산출하지 않음).",
      evidenceSufficiency: sufficiency,
      unresolvedIssues: unresolved,
    };
    return {
      bpId: key,
      expectationResults: exps,
      retrievalScore: retrievalScores[key] ?? null,
      retrievalScoreNote: retrievalScores[key] != null ? "증거 후보 검색 점수(RULE-KEYWORD-OVERLAP 계열). 충족 판단·등급이 아니다." : undefined,
      provisionalRating: rr?.provisional ?? null,
      rating,
    };
  }).map((b) => (b.retrievalScoreNote === undefined ? (delete b.retrievalScoreNote, b) : b));

  const isDoc = scope === "DOCUMENT_ADEQUACY";
  const pa = paResult ?? (isDoc
    ? { status: "NOT_APPLICABLE", value: null, rationale: "문서 적절성 검토는 실제 PA 달성을 판정하지 않는다.", evidenceSufficiency: "NOT_ASSESSED", unresolvedIssues: [] }
    : { status: "WITHHELD", value: null, rationale: "수행 증거 평가가 끝나지 않아 PA 등급을 확정하지 않는다.", evidenceSufficiency: "NOT_ASSESSED", unresolvedIssues: [] });
  const cap = capabilityResult ?? (isDoc
    ? { status: "NOT_APPLICABLE", value: null, rationale: "문서 적절성 검토는 실제 Capability Level 달성을 판정하지 않는다.", evidenceSufficiency: "NOT_ASSESSED", unresolvedIssues: [] }
    : { status: "WITHHELD", value: null, rationale: "수행 증거 평가가 끝나지 않아 Capability Level 을 확정하지 않는다.", evidenceSufficiency: "NOT_ASSESSED", unresolvedIssues: [] });

  const assessment = {
    assessmentId,
    assessmentScope: scope,
    processId,
    pamVersion: versions.pamVersion ?? processSpec.pamVersion ?? "PAM 4.1",
    guidelineVersion: versions.guidelineVersion ?? guideline.version ?? "unknown",
    engineVersion: versions.engineVersion ?? ENGINE_VERSION,
    promptVersion: versions.promptVersion ?? PROMPT_VERSION_NONE,
    ruleSetVersion: versions.ruleSetVersion ?? `${guideline.version ?? "guideline"} | ${RULE_LOGIC_VERSION}`,
    schemaVersion: SCHEMA_VERSION,
    supersedes,
    inputManifest: manifest,
    evidence,
    bpResults,
    findings: finalFindings,
    ruleEvaluations: engine.ruleEvaluations,
    conflicts,
    consistencyChecks,
    paResult: pa,
    capabilityResult: cap,
  };

  // ── 10) 최종 일관성 검증 ─────────────────────────────────────────────────
  const check = validateAssessment(assessment);
  assessment.consistencyChecks.push({
    checkId: "ASSESSMENT-INVARIANTS",
    status: check.ok ? "PASS" : "FAIL",
    detail: check.ok ? "스키마·불변조건 통과" : `스키마 ${check.schemaErrors.length}건 · 불변조건 ${check.violations.length}건 위반`,
    items: [...check.schemaErrors, ...check.violations],
  });
  return assessment;
}
