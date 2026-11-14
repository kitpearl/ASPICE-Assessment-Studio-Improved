// 증거·지적 추론 (프로세스 비종속, 순수 함수).
// 키워드/개념 탐색은 "증거 후보"를 찾는 데만 쓰고, 최종 결함 판정은 하지 않는다.
// 여기서 하는 판정은 "구조화된 증거 관계가 주어졌을 때의 결정적 규칙"이다.
import { PERFORMANCE_EVIDENCE_TYPES } from "./constants.js";
import { findConceptCandidates, conceptsIn, CONCEPTS } from "./semantics.js";

/**
 * 블록 종류 분류: 목차·BP 매핑표·자기충족 선언은 본문 증거가 아니다.
 * @returns {"TOC"|"BP_MAPPING"|"SELF_DECLARATION"|"BODY"}
 */
export function classifyBlock(text) {
  const t = String(text ?? "");
  if (/\.{3,}\s*\d*\s*$/m.test(t) || /^\s*\d+(\.\d+)*\s+\S.*\.{2,}/m.test(t) && t.split("\n").length > 2) return "TOC";
  const bpRefs = t.match(/[A-Z]{2,4}\.\d+\.BP\d+/g) ?? [];
  if (bpRefs.length >= 2 || /(BP\s*충족|BP\s*매핑|BP\s*mapping)/i.test(t)) return "BP_MAPPING";
  if (/(모두\s*충족|전부\s*충족|충족함|충족한다|compl(y|ies)\s+with\s+all)/i.test(t) && /(Capability\s*Level|CL\s*[123]|BP\s*\d)/i.test(t)) return "SELF_DECLARATION";
  return "BODY";
}

/** 블록 종류 → 증거 유형 (계획서 본문은 PLAN). */
export function evidenceTypeForBlock(kind, { isTemplate = false } = {}) {
  if (kind === "SELF_DECLARATION" || kind === "BP_MAPPING" || kind === "TOC") return "SELF_DECLARATION";
  return isTemplate ? "TEMPLATE" : "PLAN";
}

/**
 * 기대사항 하나의 증거 충족 상태를 결정한다.
 * - 평가 범위가 DOCUMENT_ADEQUACY 이면 PLAN 증거로 "문서 적절성" 충족을 인정한다.
 * - PROCESS_PERFORMANCE 이면 실행 기록·도구 설정·면담 같은 수행 증거가 있어야 SUPPORTED 이다.
 * - 목차·매핑표·자기선언만으로는 SUPPORTED 가 될 수 없다.
 * - 판독 불가 문서를 검색했으면 "관찰되지 않음"이 아니라 UNREADABLE 이다.
 *
 * @param {{
 *   scope: "DOCUMENT_ADEQUACY"|"PROCESS_PERFORMANCE",
 *   expectation: {id: string, applicable?: boolean, applicabilityRationale?: string, requiredConcepts?: string[]},
 *   links: Array<{evidenceId: string, relation: "SUPPORTS"|"PARTIAL"|"CONTRADICTS"}>,
 *   evidenceById: Map<string, {evidenceType: string}>,
 *   searchedDocs?: Array<{documentId: string, extractionStatus: string}>,
 * }} a
 */
export function evaluateExpectationStatus({ scope, expectation, links, evidenceById, searchedDocs = [] }) {
  if (expectation.applicable === false) {
    return {
      evidenceStatus: "NOT_APPLICABLE",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      applicabilityRationale: expectation.applicabilityRationale ?? "",
      missingEvidence: [],
    };
  }
  const supporting = links.filter((l) => l.relation === "SUPPORTS");
  const partial = links.filter((l) => l.relation === "PARTIAL");
  const contra = links.filter((l) => l.relation === "CONTRADICTS");
  const typeOf = (l) => evidenceById.get(l.evidenceId)?.evidenceType;
  const qualifies = (l) => (scope === "PROCESS_PERFORMANCE" ? PERFORMANCE_EVIDENCE_TYPES.includes(typeOf(l)) : !["SELF_DECLARATION"].includes(typeOf(l)));

  const missing = [];
  let status;
  const strong = supporting.filter(qualifies);
  if (contra.length && !supporting.length && !partial.length) status = "CONTRADICTED";
  else if (contra.length) status = "PARTIAL";
  else if (strong.length && !partial.length) {
    status = "SUPPORTED";
    // 기대사항이 요구하는 개념(예: 자원 가용성)을 근거 인용이 실제로 포함하는지 확인한다. 비슷한 다른 개념(자원 요구량 추정)은 대체 증거가 아니다.
    const req = expectation.requiredConcepts ?? [];
    if (req.length) {
      const cov = conceptCoverage(req, strong.map((l) => evidenceById.get(l.evidenceId)?.quote ?? ""));
      if (cov.uncovered.length) {
        status = "PARTIAL";
        for (const u of cov.uncovered) {
          const sub = cov.substitutionRisk.find((r) => r.required === u);
          missing.push(sub ? `${CONCEPTS[u]?.label ?? u} 증거가 없다(${CONCEPTS[sub.foundInstead]?.label ?? sub.foundInstead} 증거는 대체 증거가 아니다)` : `${CONCEPTS[u]?.label ?? u} 증거가 없다`);
        }
      }
    }
  }
  else if (strong.length || supporting.length || partial.length) {
    status = "PARTIAL";
    if (supporting.length && !strong.length) {
      missing.push(
        scope === "PROCESS_PERFORMANCE"
          ? "계획·템플릿·자기선언만 있고 실행 기록·도구 설정 같은 수행 증거가 없음"
          : "목차·BP 매핑표·자기충족 선언만 있고 본문 근거가 없음"
      );
    }
  } else {
    const unreadable = searchedDocs.some((d) => d.extractionStatus !== "OK");
    status = unreadable ? "UNREADABLE" : "NOT_OBSERVED";
    if (unreadable) missing.push("판독하지 못한 입력 범위가 있어 부재로 판단할 수 없음");
  }
  return {
    evidenceStatus: status,
    supportingEvidenceIds: [...supporting, ...partial].map((l) => l.evidenceId),
    contradictingEvidenceIds: contra.map((l) => l.evidenceId),
    applicabilityRationale: "",
    missingEvidence: missing,
  };
}

/**
 * 필수 개념 커버리지: 기대사항이 서로 다른 개념(예: 자원 요구량 추정 vs 자원 가용성 확인)을 요구할 때
 * 한쪽 개념의 증거로 다른 쪽을 인정하지 않는다. 반환은 "후보 단계" 판정이며 결함 확정이 아니다.
 * @returns {{covered: string[], uncovered: string[], substitutionRisk: Array<{required: string, foundInstead: string}>}}
 */
export function conceptCoverage(requiredConcepts, quotes) {
  const found = new Set();
  for (const q of quotes ?? []) for (const c of conceptsIn(q)) found.add(c);
  const covered = (requiredConcepts ?? []).filter((c) => found.has(c));
  const uncovered = (requiredConcepts ?? []).filter((c) => !found.has(c));
  const substitutionRisk = [];
  for (const req of uncovered) {
    for (const other of CONCEPTS[req]?.distinctFrom ?? []) if (found.has(other)) substitutionRisk.push({ required: req, foundInstead: other });
  }
  return { covered, uncovered, substitutionRisk };
}

/** 한 지적이 인용하는 반대 증거 상한. 이력 용량이 문서 크기에 비례해 커지지 않게 한다. */
const MAX_COUNTERS = 6;

/**
 * "X 가 없다/부족하다"는 부재 주장에 대한 반대 증거 검색(파이프라인 4단계).
 * 본문(BODY) 블록에서 같은 개념의 표현이 발견되면 주장을 기각/수정한다.
 * 개념이 발견되지 않아도 부재를 "확정"하지 않는다(DEFERRED, 심사자 확인).
 *
 * @param {{conceptId: string, claim: string}} absenceClaim
 * @param {Array<{text: string, locator?: any, blockKind?: string, evidenceId?: string}>} blocks
 * @param {{unreadable?: boolean}} [opts]
 * @returns {{disposition: "REJECTED"|"MODIFIED"|"DEFERRED"|"ACCEPTED", counterEvidence: any[], reason: string}}
 */
export function reconcileAbsenceClaim(absenceClaim, blocks, { unreadable = false } = {}) {
  const hits = absenceClaim.conceptId ? findConceptCandidates(absenceClaim.conceptId, blocks) : [];
  const body = hits.filter((h) => (h.block.blockKind ?? classifyBlock(h.block.text)) === "BODY");
  const label = CONCEPTS[absenceClaim.conceptId]?.label ?? absenceClaim.target ?? absenceClaim.conceptId;
  if (body.length) {
    return {
      disposition: "REJECTED",
      counterEvidence: body.slice(0, MAX_COUNTERS).map((h) => ({ evidenceId: h.block.evidenceId, locator: h.block.locator, quote: h.block.text, matchedTerm: h.term })),
      reason: `본문에서 '${label}' 개념에 해당하는 표현('${body[0].term}')이 발견되어 부재 주장을 기각한다. 표현이 달라도 의미가 대응하는지 심사자가 확인한다.`,
    };
  }
  if (hits.length) {
    return {
      disposition: "MODIFIED",
      counterEvidence: hits.slice(0, MAX_COUNTERS).map((h) => ({ evidenceId: h.block.evidenceId, locator: h.block.locator, quote: h.block.text, matchedTerm: h.term })),
      reason: `'${label}' 표현이 목차·매핑표·자기선언에만 있다. 본문 근거가 없다는 지적으로 수정한다.`,
    };
  }
  // 긴 서술형 대상에 들어 있는 사전 개념(예: "…의사소통하는 절차" 안의 의사소통≈통보·알림)은 "관련 개념 후보"로만 쓴다.
  // 단어 하나가 우연히 겹칠 수 있으므로 약점을 가리지 않고(ACCEPTED 유지) 단서를 인용해 심사자가 보게 한다.
  const relatedHits = [];
  for (const cid of absenceClaim.relatedConcepts ?? []) {
    for (const h of findConceptCandidates(cid, blocks)) {
      if ((h.block.blockKind ?? classifyBlock(h.block.text)) === "BODY") relatedHits.push({ ...h, cid });
    }
  }
  if (relatedHits.length) {
    return {
      disposition: "ACCEPTED",
      counterEvidence: relatedHits.slice(0, MAX_COUNTERS).map((h) => ({ evidenceId: h.block.evidenceId, locator: h.block.locator, quote: h.block.text, matchedTerm: h.term })),
      reason: `관련 개념 후보 '${CONCEPTS[relatedHits[0].cid]?.label ?? relatedHits[0].cid}' 표현('${relatedHits[0].term}')이 본문에 있다. 지적 대상과 같은 의미인지 심사자가 확인해야 한다(약점은 유지).`,
    };
  }
  // 개념 사전에는 없지만 지적 쪽(LLM)이 제시한 대체 표현이 본문에 있으면 기각하지 않고 보류한다(표현의 동등성은 사람이 확인).
  const termHits = [];
  for (const t of absenceClaim.terms ?? []) {
    const needle = String(t).toLowerCase().trim();
    if (!needle) continue; // 빈 대체 표현은 모든 줄에 일치하므로 증거가 아니다
    for (const b of blocks ?? []) {
      if ((b.blockKind ?? classifyBlock(b.text)) !== "BODY") continue;
      if (String(b.text ?? "").toLowerCase().includes(needle)) termHits.push({ block: b, term: t });
    }
  }
  // 대체 표현은 지적 쪽이 스스로 낸 목록이라 일반적인 용어가 섞일 수 있다. 그것만으로 약점을 가리지 않고(ACCEPTED 유지) 심사자 확인 사항으로 남긴다.
  if (termHits.length) {
    return {
      disposition: "ACCEPTED",
      counterEvidence: termHits.slice(0, MAX_COUNTERS).map((h) => ({ evidenceId: h.block.evidenceId, locator: h.block.locator, quote: h.block.text, matchedTerm: h.term })),
      reason: `지적이 스스로 제시한 대체 표현('${termHits[0].term}')이 본문에 있다. 같은 의미인지 심사자가 확인해야 한다(약점은 유지).`,
    };
  }
  return {
    disposition: unreadable ? "DEFERRED" : "ACCEPTED",
    counterEvidence: [],
    reason: unreadable
      ? "판독하지 못한 입력 범위가 있어 부재로 확정하지 않는다."
      : `검색한 입력에서 '${label}' 개념의 반대 증거가 발견되지 않았다(관찰되지 않음). 수행되지 않음을 뜻하지 않는다.`,
  };
}

/**
 * 같은 기대사항에 대한 강점/약점 충돌을 찾는다.
 * @param {Array<{findingId: string, expectationIds: string[], findingType: string, sourceEngine: string}>} findings
 */
export function detectFindingConflicts(findings) {
  const byExp = new Map();
  for (const f of findings ?? []) {
    for (const e of f.expectationIds ?? []) {
      if (!byExp.has(e)) byExp.set(e, []);
      byExp.get(e).push(f);
    }
  }
  const out = [];
  for (const [expectationId, list] of byExp) {
    const pos = list.filter((f) => f.findingType === "STRENGTH");
    const neg = list.filter((f) => ["WEAKNESS", "MISSING_EXPECTATION"].includes(f.findingType));
    if (pos.length && neg.length) {
      out.push({
        conflictId: `CF-FINDING-${expectationId}`,
        kind: "STRENGTH_VS_WEAKNESS",
        expectationId,
        findingIds: [...pos, ...neg].map((f) => f.findingId),
        ruleIds: [],
        rationale: `같은 기대사항(${expectationId})에 강점과 부족 지적이 함께 있다. 증거 상태로 해소해야 최종 출력에 둘 다 남지 않는다.`,
        resolution: "UNRESOLVED",
      });
    }
  }
  return out;
}

/**
 * 충돌 해소: 기대사항의 증거 상태로 강점/부족 지적의 처분(disposition)을 정한다.
 * SUPPORTED → 부족 지적 REJECTED, CONTRADICTED/NOT_OBSERVED → 강점 REJECTED,
 * PARTIAL → 둘 다 MODIFIED(부분 충족으로 재서술), UNREADABLE → 둘 다 DEFERRED.
 * @returns {{findings: any[], conflicts: any[]}} findings 는 복사본(disposition 갱신), conflicts 는 해소 상태 갱신
 */
export function resolveFindingConflicts(findings, conflicts, expectationResults) {
  const statusOf = new Map((expectationResults ?? []).map((r) => [r.expectationId, r.evidenceStatus]));
  const out = (findings ?? []).map((f) => ({ ...f }));
  const resolvedConflicts = (conflicts ?? []).map((c) => {
    const status = statusOf.get(c.expectationId);
    if (!status) return { ...c };
    // 의미 판정(LLM·심사자) 없이 후보 검색만 된 기대사항은 충족 여부를 모른다. 강점·부족 지적 모두 보류하고 심사자 확인으로 남긴다.
    const unjudged = (expectationResults ?? []).some((r) => r.expectationId === c.expectationId && (r.missingEvidence ?? []).some((m) => /의미 판정/.test(m)));
    if (unjudged) {
      for (const f of out) if (c.findingIds.includes(f.findingId)) { f.disposition = "DEFERRED"; f.dispositionReason = `기대사항 ${c.expectationId} 에 의미 판정이 없어 강점·부족 지적의 충돌을 해소할 수 없다. 심사자 확인 필요.`; }
      return { ...c, resolution: "REVIEW_REQUIRED" };
    }
    const members = out.filter((f) => c.findingIds.includes(f.findingId));
    const setAll = (pred, disposition, reason) => {
      for (const f of members) if (pred(f)) { f.disposition = disposition; f.dispositionReason = reason; }
    };
    const isNeg = (f) => ["WEAKNESS", "MISSING_EXPECTATION"].includes(f.findingType);
    const isPos = (f) => f.findingType === "STRENGTH";
    let resolution = "UNRESOLVED";
    if (status === "SUPPORTED") {
      setAll(isNeg, "REJECTED", `기대사항 ${c.expectationId} 의 증거가 SUPPORTED 이므로 부족 지적을 기각한다.`);
      setAll(isPos, "ACCEPTED", "증거가 뒷받침한다.");
      resolution = "RESOLVED_BY_EVIDENCE";
    } else if (status === "CONTRADICTED" || status === "NOT_OBSERVED") {
      setAll(isPos, "REJECTED", `기대사항 ${c.expectationId} 의 증거가 ${status} 이므로 강점 주장을 기각한다.`);
      setAll(isNeg, "ACCEPTED", "증거 상태가 지적과 일치한다.");
      resolution = "RESOLVED_BY_EVIDENCE";
    } else if (status === "PARTIAL") {
      setAll(() => true, "MODIFIED", `기대사항 ${c.expectationId} 가 부분 충족이므로 강점·부족 지적을 '충족된 부분/남은 부분'으로 나누어 재서술한다.`);
      resolution = "RESOLVED_BY_EVIDENCE";
    } else if (status === "UNREADABLE") {
      setAll(() => true, "DEFERRED", "판독 불가 범위가 있어 판단을 보류한다.");
      resolution = "REVIEW_REQUIRED";
    }
    return { ...c, resolution };
  });
  return { findings: out, conflicts: resolvedConflicts };
}

/**
 * 목록 소속 주장 검증: "<목록 종류>에 X 가 포함된다"는 주장이 실제 그 목록의 항목인지 확인한다.
 * (예: 영향분석 영역 목록과 CCB 역할 목록을 혼동하는 오류)
 * @param {{listKind: string, claimedItems: string[]}} claim
 * @param {Record<string, string[]>} documentLists 문서에서 추출한 목록 종류별 항목
 */
export function verifyListMembershipClaim(claim, documentLists) {
  const actual = (documentLists[claim.listKind] ?? []).map(normItem);
  const misplaced = [];
  const notFound = [];
  for (const item of claim.claimedItems) {
    const n = normItem(item);
    if (actual.some((a) => a === n || a.includes(n) || n.includes(a))) continue;
    const home = Object.entries(documentLists).find(([k, items]) => k !== claim.listKind && items.map(normItem).some((a) => a === n || a.includes(n) || n.includes(a)));
    if (home) misplaced.push({ item, actualListKind: home[0] });
    else notFound.push(item);
  }
  return { ok: !misplaced.length && !notFound.length, misplaced, notFound };
}
const normItem = (s) => String(s ?? "").toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();

/**
 * 계획서의 선언을 "구현되어 있음/수행되고 있음"으로 서술했는지 검사한다.
 * 수행 증거(EXECUTION_RECORD/TOOL_CONFIGURATION/INTERVIEW)가 없으면 위반이다.
 * @returns {{violation: boolean, suggestion?: string}}
 */
export function checkExecutionWording(claimText, evidenceTypes) {
  const asserts = /(구현되어\s*있|수행되고\s*있|운영되고\s*있|적용되고\s*있|자동\s*(으로\s*)?(관리|추적|통보)되고\s*있|(is|are)\s+(implemented|performed|operating))/i.test(claimText ?? "");
  const hasPerformance = (evidenceTypes ?? []).some((t) => PERFORMANCE_EVIDENCE_TYPES.includes(t));
  if (asserts && !hasPerformance) {
    return {
      violation: true,
      suggestion: "계획서가 …하도록 정의/계획하고 있다 로 서술하고, 실제 운영은 도구 설정·실행 기록으로 확인 필요 항목에 둔다.",
    };
  }
  return { violation: false };
}
