// 가이드라인 2026 규칙 조회 Map (모듈 단위 지연 캐시). applyAppliedRules 재적용용.
import { loadGuideline } from "../../spec/canonical/index.js";

let _rulesById;

/** @returns {Map<string, any>} */
export function getGuidelineRulesById() {
  if (!_rulesById) _rulesById = new Map((loadGuideline().rules ?? []).map((r) => [r.id, r]));
  return _rulesById;
}
