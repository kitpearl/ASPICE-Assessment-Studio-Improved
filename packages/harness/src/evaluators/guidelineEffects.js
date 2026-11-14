/**
 * 가이드라인 규칙 효과 적용기 (순수 함수). 규칙 조회 Map 은 호출자가 만든다.
 * 등급 상한 퍼센트는 spec/canonical/ratingScale.json 의 N max 15, P+ max 50,
 * L+ max 85 와 일치해야 한다.
 */
import { truncate, SUMMARY_CHARS } from "../knowledge/select.js";

/**
 * 등급 조건 규칙이 "…때문에/…로 인해 P·N 이라면" 처럼 하향 "사유"까지 요구하는지(영문 원문 due to/because 기준).
 * 가이드라인 추출기의 reasonQualified 플래그는 "하향 평가된다면"(등급 수준 미명시)에만 붙고,
 * "N 또는 P로 등급 평가된다면 …"에 사유가 함께 있는 규칙(SUP.10.RL.2/9/11, SUP.9.RL.1)에는 빠져 있다.
 * 사유는 출처 지표의 점수만으로 검증할 수 없다.
 * @param {{textEn?: string}} rule
 */
export function requiresReasonJudgment(rule) {
  return /\b(due to|because of|because|caused by)\b/i.test(rule?.textEn ?? "");
}

export const RATING_CAP_PERCENT = { N: 15, P: 50, L: 85 };

/**
 * @param {{kind: string, maxRating?: string}|undefined} effect
 * @param {number} [sourcePercent]
 * @returns {number|null}
 */
export function capForEffect(effect, sourcePercent) {
  if (!effect) return null;
  switch (effect.kind) {
    case "cap":
      return RATING_CAP_PERCENT[effect.maxRating] ?? null;
    case "must-downrate":
      return RATING_CAP_PERCENT.L;
    case "cap-source":
      return typeof sourcePercent === "number" ? sourcePercent : null;
    default:
      return null;
  }
}

/**
 * 상한 표시 문구. cap-source 는 출처 지표 ID 가 있으면 "<ID> 점수".
 * @param {{kind: string, maxRating?: string}|undefined} effect
 * @param {string} [sourceId]
 */
export function capLabel(effect, sourceId) {
  if (effect?.kind === "must-downrate") return "L";
  if (effect?.kind === "cap-source") return sourceId ? `${sourceId} 점수` : "출처 점수";
  return effect?.maxRating ?? "";
}

/**
 * cap-source 는 원천 지표 퍼센트를 알아야 하므로 여기서는 적용하지 않는다
 * (등급 조건 후처리기 담당).
 * @param {{scorePercent: number, gaps?: string[], appliedRules?: any[]}} result
 * @param {Map<string, any>} rulesById
 */
export function applyAppliedRules(result, rulesById) {
  const applied = Array.isArray(result.appliedRules) ? result.appliedRules : [];
  for (const entry of applied) {
    if (!entry || entry.applied === false) continue;
    const rule = rulesById.get(entry.ruleId);
    if (!rule) continue;
    // 타 프로세스 조건 규칙은 표시 전용, 사유 한정이 아닌 등급 조건 규칙은 결정론적 후처리기 담당
    if (rule.condition?.crossProcess) continue;
    // 출처 지표 등급을 볼 수 없는 LLM 의 주장만으로 등급 조건 규칙의 상한을 걸지 않는다(reasonQualified 플래그 규칙만 허용).
    // 사유 판정 규칙(due to)은 결정적 후처리(ratingConditions)가 출처 등급 확인 후 검토 대기로 다룬다.
    if (rule.condition?.kind === "rating" && !rule.condition.reasonQualified) continue;
    const cap = capForEffect(rule.effect);
    if (cap === null || !(result.scorePercent > cap)) continue;
    // 깎이기 전 점수를 항목에 남긴다(검증되지 않은 LLM 규칙 주장이 점수에 먼저 반영돼도 원래 값을 복원할 수 있도록).
    entry.scoreBefore = result.scorePercent;
    result.scorePercent = cap;
    const summary = truncate(rule.text, SUMMARY_CHARS);
    if (!Array.isArray(result.gaps)) result.gaps = [];
    result.gaps.push(`가이드라인 [${rule.id ?? entry.ruleId}] 적용: 상한 ${capLabel(rule.effect)} (${summary})`);
    entry.capped = true;
  }
  return result;
}

/** LLM 이 cap:N 규칙을 적용하려면 자신의 원점수가 이 값 이하(P 이하)여야 한다. */
export const LLM_CAP_N_MAX = 50;
/** LLM 이 cap:P 규칙을 적용하려면 자신의 원점수가 이 값 이하(L- 이하)여야 한다. */
export const LLM_CAP_P_MAX = 67;

/**
 * LLM 이 보고한 guidelineCitations 를 LLM 자신의 원점수(컨텍스트 배수 적용 전)와 대조해
 * 보수적으로 수용한다.
 *  - cap:N 규칙: llmRawScore > LLM_CAP_N_MAX 이면 보류
 *  - cap:P 규칙: llmRawScore > LLM_CAP_P_MAX 이면 보류
 *  - applied=true 인데 note 가 비어 있으면(공백 제외 길이 0) 보류
 * 보류 = 새 항목(applied=false, capped 없음, note="[보류: <사유>] " + 원래 note, source 유지).
 * 그 외(must-downrate, cap:L, cap-source 등)는 그대로 통과. applied=false, 미지 ID,
 * source="rule-engine" 항목은 건드리지 않는다. 입력 배열은 바꾸지 않고 새 배열을 반환한다.
 * 점수와 gap 은 바꾸지 않는다(보류는 기록만 남긴다).
 * @param {number} llmRawScore
 * @param {Array<{ruleId: string, applied: boolean, note: string, source?: string}>} rules
 * @param {Map<string, any>} rulesById
 */
export function guardLlmCitations(llmRawScore, rules, rulesById) {
  if (!Array.isArray(rules)) return [];
  return rules.map((entry) => {
    const reason = holdReason(llmRawScore, entry, rulesById);
    return reason === null ? entry : hold(entry, reason);
  });
}

function holdReason(llmRawScore, entry, rulesById) {
  if (!entry || entry.applied !== true || entry.source === "rule-engine") return null;
  const rule = rulesById?.get(entry.ruleId);
  if (!rule) return null;
  const effect = rule.effect;
  if (effect?.kind === "cap") {
    const max = effect.maxRating === "N" ? LLM_CAP_N_MAX : effect.maxRating === "P" ? LLM_CAP_P_MAX : null;
    if (max !== null && llmRawScore > max) return `LLM 점수 ${llmRawScore}% 와 불일치`;
  }
  if (typeof entry.note !== "string" || entry.note.trim() === "") return "근거 없음";
  if (rule.condition?.kind === "evidence" && noteNegatesTrigger(entry.note)) return "적용 사유가 규칙 조건의 불성립을 서술함";
  return null;
}

/**
 * 증거형 조건 규칙(예: "모든 관련자가 대표되지 않는다면 F 불가")을 적용했다고 하면서 note 는 조건이 성립하지 않음
 * ("모든 … 대표되어 있음", "충족됨")을 서술하는 자기모순을 찾는다. 적용 후보로만 남기고 확정하지 않는다.
 */
export function noteNegatesTrigger(note) {
  const t = String(note ?? "");
  return /(모든|전체|전원).{0,30}(대표|포함|반영|정의|수행)(되어|돼)\s*있(?!\s*지\s*않)/.test(t) || /(규칙|조건).{0,12}(충족됨|충족된다|충족되어|불성립)/.test(t);
}

function hold(entry, reason) {
  const prefix = `[보류: ${reason}]`;
  const note = typeof entry.note === "string" && entry.note.trim() !== "" ? `${prefix} ${entry.note}` : prefix;
  const held = { ...entry, applied: false, note };
  delete held.capped;
  return held;
}

/**
 * @param {unknown} raw
 * @param {Set<string>} knownIds
 * @returns {Array<{ruleId: string, applied: boolean, note: string}>}
 */
export function normalizeGuidelineCitations(raw, knownIds) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.ruleId;
    if (typeof id !== "string" || !knownIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ ruleId: id, applied: entry.applied === true, note: typeof entry.note === "string" ? entry.note : "" });
  }
  return out;
}
