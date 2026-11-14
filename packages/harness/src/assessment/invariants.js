// 구조화 평가의 불변조건 검증. 스키마 검증(형식) 위에서 "참조 무결성·의미 일관성"을 확인한다.
import { validateAgainstSchema } from "./schemaValidator.js";

const HARD_EFFECTS = new Set(["EXCLUDE_F", "CAP_AT_RATING", "DOWNRATE_REQUIRED", "NOT_HIGHER_THAN_SOURCE"]);
const NEGATIVE_TYPES = new Set(["WEAKNESS", "MISSING_EXPECTATION"]);
const ACTIVE = new Set(["ACCEPTED", "MODIFIED"]);

/** 확정적으로 효과를 적용한 것으로 취급하는 상태 */
const EFFECT_APPLIED = new Set(["APPLIED", "APPLIED_NO_CHANGE", "CONSTRAINT_RECORDED"]);

/**
 * @param {any} a 평가 객체
 * @returns {{ok: boolean, schemaErrors: Array<{path: string, message: string}>, violations: Array<{code: string, message: string, ref?: string}>}}
 */
export function validateAssessment(a) {
  const schemaErrors = validateAgainstSchema(a);
  const violations = [];
  const v = (code, message, ref) => violations.push({ code, message, ...(ref ? { ref } : {}) });
  if (schemaErrors.length) return { ok: false, schemaErrors, violations };

  const evidenceIds = new Set(a.evidence.map((e) => e.evidenceId));
  const docById = new Map(a.inputManifest.map((d) => [d.documentId, d]));
  const checkRefs = (ids, owner) => {
    for (const id of ids ?? []) if (!evidenceIds.has(id)) v("INV-EVIDENCE-REF", `${owner} 가 존재하지 않는 evidenceId '${id}' 를 인용한다`, owner);
  };

  for (const e of a.evidence) {
    if (!docById.has(e.documentId)) v("INV-EVIDENCE-DOC", `증거 ${e.evidenceId} 의 documentId '${e.documentId}' 가 inputManifest 에 없다`, e.evidenceId);
  }

  for (const bp of a.bpResults) {
    for (const r of bp.expectationResults) {
      const owner = `${bp.bpId}/${r.expectationId}`;
      checkRefs(r.supportingEvidenceIds, owner);
      checkRefs(r.contradictingEvidenceIds, owner);
      if (r.evidenceStatus === "NOT_APPLICABLE" && !String(r.applicabilityRationale ?? "").trim()) v("INV-NA-RATIONALE", `${owner}: 해당 없음에는 적용 제외 사유가 필요하다`, owner);
      if (r.evidenceStatus === "SUPPORTED" && !r.supportingEvidenceIds.length) v("INV-SUPPORTED-NO-EVIDENCE", `${owner}: SUPPORTED 인데 근거 증거가 없다`, owner);
      if (r.evidenceStatus === "NOT_OBSERVED") {
        const unreadable = (r.searchedDocumentIds ?? []).filter((d) => (docById.get(d)?.extractionStatus ?? "OK") !== "OK");
        if (unreadable.length) v("INV-UNREADABLE-AS-ABSENT", `${owner}: 판독 불가/부분 판독 문서(${unreadable.join(", ")})를 검색했는데 NOT_OBSERVED 로 기록했다. UNREADABLE 이어야 한다`, owner);
      }
    }
    if (bp.rating.status === "NOT_APPLICABLE" && !String(bp.rating.rationale ?? "").trim()) v("INV-NA-RATIONALE", `${bp.bpId}: 해당 없음 등급에는 사유가 필요하다`, bp.bpId);
    if (bp.rating.status === "FINAL" && bp.rating.value == null) v("INV-FINAL-NO-VALUE", `${bp.bpId}: FINAL 등급은 값이 있어야 한다`, bp.bpId);
    if (bp.rating.status === "FINAL" && bp.rating.unresolvedIssues.length) v("INV-FINAL-UNRESOLVED", `${bp.bpId}: 미해결 사항이 있는 등급은 FINAL 일 수 없다`, bp.bpId);
  }

  const findingIds = new Set();
  for (const f of a.findings) {
    if (findingIds.has(f.findingId)) v("INV-FINDING-DUP", `findingId '${f.findingId}' 중복`, f.findingId);
    findingIds.add(f.findingId);
    checkRefs(f.evidenceIds, f.findingId);
    if (f.disposition === "REJECTED" && !String(f.dispositionReason ?? "").trim()) v("INV-REJECT-REASON", `${f.findingId}: 기각 사유가 필요하다`, f.findingId);
  }

  for (const r of a.ruleEvaluations) {
    const owner = `${r.ruleId}${r.targetId ? `→${r.targetId}` : ""}`;
    checkRefs(r.conditionEvidenceIds, owner);
    const sigOk = r.significanceConditionResult == null || r.significanceConditionResult === "TRUE";
    if (HARD_EFFECTS.has(r.effectType) && r.applicationStatus === "APPLIED" && !(r.conditionResult === "TRUE" && sigOk)) {
      v("INV-RULE-CONDITION", `${owner}: 조건이 ${r.conditionResult}${r.significanceConditionResult ? `/중요도 ${r.significanceConditionResult}` : ""} 인데 하향·상한 효과를 확정 적용했다`, owner);
    }
    if (r.conditionResult === "UNKNOWN" && EFFECT_APPLIED.has(r.applicationStatus)) v("INV-RULE-UNKNOWN-APPLIED", `${owner}: 조건 UNKNOWN 은 검토 대기여야 한다`, owner);
    if (r.conditionResult === "FALSE" && EFFECT_APPLIED.has(r.applicationStatus)) v("INV-RULE-FALSE-APPLIED", `${owner}: 조건 FALSE 인데 적용 상태다`, owner);
    if (r.effectType === "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON" && r.beforeRating && r.afterRating && r.afterRating !== r.beforeRating) v("INV-PROHIBIT-CHANGED-RATING", `${owner}: 하향 금지 규칙이 등급을 바꿀 수 없다`, owner);
    if (r.effectType === "DOWNRATE_REQUIRED" && r.applicationStatus === "APPLIED" && !r.rationale.includes("심사자 결정")) v("INV-DOWNRATE-ARBITRARY", `${owner}: 하향 폭은 심사자 결정에 근거해야 한다`, owner);
  }

  // 같은 기대사항에 대해 ACCEPTED 강점과 ACCEPTED 부족 지적이 함께 있으면 충돌이 해소되지 않은 것
  const byExp = new Map();
  for (const f of a.findings) {
    if (!ACTIVE.has(f.disposition)) continue;
    for (const e of f.expectationIds) {
      const s = byExp.get(e) ?? { pos: [], neg: [] };
      if (f.findingType === "STRENGTH") s.pos.push(f.findingId);
      if (NEGATIVE_TYPES.has(f.findingType)) s.neg.push(f.findingId);
      byExp.set(e, s);
    }
  }
  for (const [exp, s] of byExp) {
    if (s.pos.length && s.neg.length && f_modifiedBoth(a.findings, s) === false) {
      v("INV-UNRESOLVED-FINDING-CONFLICT", `기대사항 ${exp}: 강점(${s.pos.join(",")})과 부족 지적(${s.neg.join(",")})이 해소되지 않은 채 함께 채택되었다`, exp);
    }
  }

  // 평가 범위: 문서 적절성 검토는 실제 PA/CL 달성을 FINAL 로 낼 수 없다
  if (a.assessmentScope === "DOCUMENT_ADEQUACY") {
    for (const [name, r] of [["paResult", a.paResult], ["capabilityResult", a.capabilityResult]]) {
      if (r.status === "FINAL" || r.status === "PROPOSED" || r.value != null) {
        v("INV-SCOPE-ACHIEVEMENT", `${name}: 문서 적절성 검토에서는 실제 PA/CL 달성을 제시할 수 없다(WITHHELD 또는 NOT_APPLICABLE 이어야 한다)`, name);
      }
    }
  }
  for (const c of a.conflicts) {
    if (c.resolution === "UNRESOLVED" && a.bpResults.some((b) => b.rating.status === "FINAL")) v("INV-FINAL-WITH-OPEN-CONFLICT", `충돌 ${c.conflictId} 가 해소되지 않았는데 FINAL 등급이 있다`, c.conflictId);
  }
  return { ok: violations.length === 0, schemaErrors, violations };
}

/** 두 지적이 모두 MODIFIED 로 재서술된 경우(부분 충족)는 충돌 해소로 본다. */
function f_modifiedBoth(findings, s) {
  const ids = [...s.pos, ...s.neg];
  return findings.filter((f) => ids.includes(f.findingId)).every((f) => f.disposition === "MODIFIED");
}
