/**
 * 가이드라인 규칙 효과 적용기 (순수 함수). 규칙 조회 Map 은 호출자가 만든다.
 * 등급 상한 퍼센트는 spec/canonical/ratingScale.json 의 N max 15, P+ max 50,
 * L+ max 85 와 일치해야 한다.
 */

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
    const cap = capForEffect(rule.effect);
    if (cap === null || !(result.scorePercent > cap)) continue;
    result.scorePercent = cap;
    const summary = String(rule.text ?? "").slice(0, 60);
    if (!Array.isArray(result.gaps)) result.gaps = [];
    result.gaps.push(`가이드라인 [${rule.id ?? entry.ruleId}] 적용: 상한 ${capLabel(rule.effect)} (${summary})`);
    entry.capped = true;
  }
  return result;
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
