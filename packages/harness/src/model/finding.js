/**
 * Finding 모델 — BP 평가의 결과를 "키워드 매칭 retrieval"이 아니라
 * "결론 진술 (Conclusion statement)" 형태로 표현하기 위한 구조화 객체.
 *
 * 기존 BPResult.evidence / gaps 는 그대로 유지하면서, 이 Finding[] 을
 * BPResult.findings 슬롯에 추가로 실어 보낸다. UI 가 아직 Finding 을
 * 모르더라도 evidence / gaps 만 보고 그릴 수 있도록 어댑터를 함께 제공한다.
 *
 * 표준 인용 데이터(BGB Rating Level, ISO clause, PAM Note) 는
 * packages/harness/spec/bgb/bpToRatingLevels.csv,
 * packages/harness/spec/iso/bpToClauses.csv 에서 P5 단계에서 ingest 한다.
 * P1 에서는 슬롯만 정의해 두며, 실제 값은 빈 배열로 시작한다.
 *
 * @typedef {import("./verdict.js").Evidence} Evidence
 *
 * @typedef {Object} StandardReferences
 * @property {string[]} pam       e.g. ["PAM §SWE.2 BP1"]
 * @property {string[]} pamNote   e.g. ["PAM Note SWE.2-1"]
 * @property {string[]} bgbRL     e.g. ["RL3", "RL3.2"]
 * @property {string[]} iso       e.g. ["ISO 26262-6:2018 §8.4.5"]
 * @property {string[]} incose    e.g. ["INCOSE GtWR C7", "INCOSE GtWR R18"]
 *
 * @typedef {Object} FindingLocation
 * @property {?string} found       산출물에서 관찰된 정확한 위치 (없으면 null)
 * @property {?string} recommended 부재 시 권고되는 산출물 내 위치 (없으면 null)
 *
 * @typedef {Object} RatingImpact
 * @property {boolean} ruleApplied  Rating Rule 이 명시적으로 적용되었는가
 * @property {?string} ruleId       적용된 룰 ID (예: "RR-NOT-DOCUMENTED")
 * @property {number}  scoreDelta   scorePercent 에 미친 영향 (감점이면 음수)
 * @property {string}  reason       동사로 시작하는 짧은 사유 진술
 *
 * @typedef {"strength"|"weakness"|"observation"} FindingType
 *
 * @typedef {Object} Finding
 * @property {string}  id                   BP 내 유일 (예: "F-SWE.2.BP1-01")
 * @property {string}  bpId                 BP 식별자 (예: "SWE.2.BP1")
 * @property {FindingType} type
 * @property {string}  situation            관찰된 사실의 객관적 진술 ("키워드 미발견" 금지)
 * @property {string}  gap                  무엇이 부족/미흡한지의 구체적 진술
 * @property {string}  impact               BP outcome / capability 에 미치는 영향
 * @property {string}  recommendation       동사로 시작하는 실행 가능한 권고 (예: "추가하라", "수정하라")
 * @property {FindingLocation} location
 * @property {Evidence[]} evidence          뒷받침 인용
 * @property {StandardReferences} standardReferences
 * @property {RatingImpact} ratingImpact
 * @property {string[]} expectationIds  이 지적이 해당하는 기대사항 ID (프롬프트의 기대사항 목록에서 선택, 없으면 [])
 * @property {?{target: string, alternativeTerms: string[]}} absenceClaim  "…이 없다/부족하다"는 부재 주장이면 대상과 문서가 같은 의미로 쓸 수 있는 대체 표현
 * @property {boolean} expectationIdsDeclared  expectationIds 필드를 응답이 명시했는지(빈 배열 포함)
 * @property {boolean} claimsExecution  계획이 아니라 실제로 구현·수행되고 있다고 단정하는 서술이면 true
 */

/** @returns {StandardReferences} */
export function makeEmptyStandardReferences() {
  return { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] };
}

/** @returns {FindingLocation} */
export function makeEmptyLocation() {
  return { found: null, recommended: null };
}

/** @returns {RatingImpact} */
export function makeEmptyRatingImpact() {
  return { ruleApplied: false, ruleId: null, scoreDelta: 0, reason: "" };
}

/**
 * Finding factory. partial 의 필드만 덮어쓰고 나머지는 빈 슬롯으로 채운다.
 * @param {Partial<Finding>} partial
 * @returns {Finding}
 */
function normalizeAbsenceClaim(raw) {
  if (!raw || typeof raw !== "object") return null;
  const target = typeof raw.target === "string" ? raw.target.trim() : "";
  if (!target) return null;
  const terms = Array.isArray(raw.alternativeTerms) ? raw.alternativeTerms.filter((t) => typeof t === "string" && t.trim().length >= 2).map((t) => t.trim()).slice(0, 8) : [];
  return { target, alternativeTerms: terms };
}

export function makeFinding(partial = {}) {
  return {
    id: partial.id ?? "",
    bpId: partial.bpId ?? "",
    type: partial.type ?? "observation",
    situation: partial.situation ?? "",
    gap: partial.gap ?? "",
    impact: partial.impact ?? "",
    recommendation: partial.recommendation ?? "",
    location: partial.location ? { ...makeEmptyLocation(), ...partial.location } : makeEmptyLocation(),
    evidence: Array.isArray(partial.evidence) ? partial.evidence : [],
    standardReferences: partial.standardReferences
      ? { ...makeEmptyStandardReferences(), ...partial.standardReferences }
      : makeEmptyStandardReferences(),
    ratingImpact: partial.ratingImpact
      ? { ...makeEmptyRatingImpact(), ...partial.ratingImpact }
      : makeEmptyRatingImpact(),
    expectationIds: Array.isArray(partial.expectationIds) ? partial.expectationIds.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [],
    absenceClaim: normalizeAbsenceClaim(partial.absenceClaim),
    claimsExecution: partial.claimsExecution === true,
    // LLM 이 expectationIds 필드를 명시했는지(빈 배열 포함). 명시했다면 변환기가 후보 매핑으로 덮어쓰지 않는다.
    expectationIdsDeclared: Array.isArray(partial.expectationIds),
  };
}

const VERB_FIRST_RE = /^(추가|수정|보완|작성|기록|정의|연결|삭제|점검|검토|개선|명시|제거|반영|확인|구축|추적|승인|적용)/;

/**
 * Finding 의 필수 진술 슬롯이 채워져 있고 recommendation 이 동사로 시작하는지 검사.
 * recommendation 의 동사 검증은 한국어 평가 가이드(요청 7) 충족을 보장하기 위함.
 * @param {Finding} f
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateFinding(f) {
  if (!f || typeof f !== "object") return { ok: false, reason: "finding is not an object" };
  if (!f.bpId) return { ok: false, reason: "finding.bpId is empty" };
  if (!f.situation) return { ok: false, reason: "finding.situation is empty (객관적 사실 진술 필요)" };
  if (f.type === "weakness") {
    if (!f.gap) return { ok: false, reason: "weakness finding 은 gap 진술이 필요" };
    if (!f.recommendation) return { ok: false, reason: "weakness finding 은 recommendation 이 필요" };
    if (!VERB_FIRST_RE.test(f.recommendation)) {
      return { ok: false, reason: `recommendation 은 동사로 시작해야 함 (받은 값: "${f.recommendation.slice(0, 30)}...")` };
    }
  }
  return { ok: true };
}

/**
 * Finding[] → 기존 UI 호환 evidence 배열로 다운프로젝션.
 * UI 의 EvidenceList 는 {location, quote} 형태를 기대하므로 Finding 의
 * evidence + location.found 를 합쳐 평탄화한다. Finding 이 evidence 를
 * 아예 안 갖고 있다면 location.found / recommended 를 quote 로 활용한다.
 *
 * @param {Finding[]} findings
 * @returns {Evidence[]}
 */
export function findingsToLegacyEvidence(findings) {
  if (!Array.isArray(findings)) return [];
  const out = [];
  for (const f of findings) {
    if (Array.isArray(f.evidence) && f.evidence.length > 0) {
      for (const ev of f.evidence) {
        out.push({
          artifactName: ev.artifactName || "",
          quote: ev.quote || "",
          location: ev.location || f.location?.found || "",
        });
      }
    } else if (f.location?.found || f.location?.recommended) {
      out.push({
        artifactName: "",
        quote: f.gap || f.situation || "",
        location: f.location.found || `권고 위치: ${f.location.recommended}`,
      });
    }
  }
  return out;
}

/**
 * Finding[] → 기존 UI rationale 문자열로 다운프로젝션.
 * BPResult.findings 가 비어 있으면 BPResult.gaps[0] 를 그대로 사용 (legacy).
 * weakness 의 경우 "{gap} — {recommendation}" 형태로 직렬화한다.
 *
 * @param {Finding[] | undefined} findings
 * @param {string[] | undefined} legacyGaps
 * @returns {string}
 */
export function findingsToLegacyRationale(findings, legacyGaps) {
  if (Array.isArray(findings) && findings.length > 0) {
    const weak = findings.filter((f) => f.type === "weakness");
    const target = weak.length > 0 ? weak : findings;
    // 권고(recommendation)는 BP 평가 결과에서 제외한다 (요청). 따라서 legacy
    // rationale 직렬화도 gap/situation 만 사용한다.
    return target
      .map((f) => (f.gap || f.situation || "").trim())
      .filter(Boolean)
      .join(" / ");
  }
  if (Array.isArray(legacyGaps) && legacyGaps.length > 0) return legacyGaps.join(" / ");
  return "";
}
