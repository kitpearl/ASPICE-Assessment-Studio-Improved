import { makeFinding } from "../model/finding.js";

/**
 * Rule-mode / Custom-mode 의 결정적 평가에서 Finding 객체를 생성하기 위한
 * 공통 빌더. Rule-mode 는 의미적 평가를 할 수 없으므로 항상 "observation"
 * 타입으로 발행한다 — 작성팀/경영진/시니어 평가자가 "자동 휴리스틱 패스이며
 * 의미 평가는 별도 필요" 라는 점을 인지할 수 있어야 한다.
 *
 * weakness/strength 같은 단정적 판단은 LLM 모드에서만 만들어진다 (P2).
 * 따라서 P3 의 rule/custom Finding 은 다음 특성을 갖는다:
 *   - type: "observation"
 *   - recommendation: "검토하라: ..." 형태로 시니어 검토를 유도
 *   - ratingImpact.ruleApplied: true (어떤 룰이 적용되었는지 ruleId 로 추적)
 *
 * standardReferences 의 pam 만 spec 의 BP 정의에서 가져와 채우고, pamNote /
 * bgbRL / iso 는 P5 의 CSV ingest 가 끝난 뒤 별도 단계에서 보강한다.
 */

const STANDARD_REFS_EMPTY = { pam: [], pamNote: [], bgbRL: [], iso: [] };

function locationFromEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const names = Array.from(new Set(evidence.map((e) => e?.artifactName).filter(Boolean)));
  return names.length ? names.join(", ") : null;
}

/**
 * Rule-mode (offline keyword 휴리스틱) 의 observation finding.
 *
 * recommendation 슬롯은 비워 둔다. Rule-mode 관찰은 "어떤 룰이 무엇을
 * 확인했는지" 를 situation 으로 진술할 뿐, 자동으로 시정 행위를 권고할 만한
 * 의미 판단을 하지 않는다 (그 판단은 시니어 평가자/LLM 모드의 몫). 따라서
 * 과거의 보일러플레이트 "검토하라: …" 권고는 발행하지 않는다.
 *
 * @param {{
 *   bpFullId: string,             예: "SWE.2.BP1" / "SWE.2.04-04" / "SWE.2.GP 1.1.1"
 *   ruleId: string,               ratingImpact.ruleId 에 기록될 룰 식별자
 *   situation: string,            객관적 관찰 진술 (호출자가 mode/score 컨텍스트를 담아 전달)
 *   evidence?: import("../model/verdict.js").Evidence[],
 *   pamCitation?: string,         spec 의 BP/GP/WP pamCitation 이 있으면 그대로 사용
 *   scoreReason: string,          ratingImpact.reason — 동사로 시작 권장
 * }} args
 * @returns {import("../model/finding.js").Finding}
 */
export function buildRuleObservationFinding({
  bpFullId,
  ruleId,
  situation,
  evidence = [],
  pamCitation,
  scoreReason,
}) {
  const refs = pamCitation
    ? { pam: [pamCitation], pamNote: [], bgbRL: [], iso: [] }
    : { ...STANDARD_REFS_EMPTY };
  return makeFinding({
    id: `F-rule-${bpFullId}-01`,
    bpId: bpFullId,
    type: "observation",
    situation,
    recommendation: "",
    location: {
      found: locationFromEvidence(evidence),
      recommended: null,
    },
    evidence: evidence.slice(),
    standardReferences: refs,
    ratingImpact: {
      ruleApplied: true,
      ruleId,
      scoreDelta: 0,
      reason: scoreReason,
    },
  });
}

/**
 * Custom-mode (사용자 룰 북) 의 observation finding. 룰 1개당 1 finding.
 *
 * @param {{
 *   bpFullId: string,
 *   rule: { id: string, label: string },
 *   satisfied: boolean,
 *   evidence?: import("../model/verdict.js").Evidence[],
 *   matchedCount?: number,
 *   totalKeywords?: number,
 * }} args
 * @returns {import("../model/finding.js").Finding}
 */
export function buildCustomRuleObservationFinding({
  bpFullId,
  rule,
  satisfied,
  evidence = [],
  matchedCount = 0,
  totalKeywords = 0,
}) {
  const head = `사용자 룰 "${rule.label}"`;
  const situation = satisfied
    ? `${head} 충족: 산출물 ${evidence.length}건에서 일치 증거 관찰 (의미적 충족 여부는 시니어 평가자가 추가 확인 필요)`
    : `${head} 미충족: 룰이 요구하는 조건과 일치하는 증거가 관찰되지 않음`;
  // 권고(recommendation)는 BP 평가 결과에서 제외한다 (요청).
  return makeFinding({
    id: `F-custom-${bpFullId}-${rule.id}`,
    bpId: bpFullId,
    type: "observation",
    situation,
    recommendation: "",
    location: {
      found: locationFromEvidence(evidence),
      recommended: null,
    },
    evidence: evidence.slice(),
    standardReferences: { ...STANDARD_REFS_EMPTY },
    ratingImpact: {
      ruleApplied: true,
      ruleId: `CUSTOM:${rule.id}`,
      scoreDelta: 0,
      reason: `계산하라: 사용자 룰 가중치 기반 비율 (${matchedCount}/${totalKeywords})`,
    },
  });
}

/**
 * 두 StandardReferences 를 합집합으로 병합 (각 필드 중복 제거).
 * Hybrid 스코어러가 rule + llm 결과를 합칠 때 사용한다.
 *
 * @param {import("../model/finding.js").StandardReferences | undefined} a
 * @param {import("../model/finding.js").StandardReferences | undefined} b
 * @returns {import("../model/finding.js").StandardReferences}
 */
export function unionStandardReferences(a, b) {
  const aa = a ?? STANDARD_REFS_EMPTY;
  const bb = b ?? STANDARD_REFS_EMPTY;
  const uniq = (x, y) => Array.from(new Set([...(x ?? []), ...(y ?? [])]));
  return {
    pam: uniq(aa.pam, bb.pam),
    pamNote: uniq(aa.pamNote, bb.pamNote),
    bgbRL: uniq(aa.bgbRL, bb.bgbRL),
    iso: uniq(aa.iso, bb.iso),
  };
}
