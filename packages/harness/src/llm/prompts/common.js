// 세 프롬프트 빌더가 공유하는 문구·블록 조립기.
import { formatRulesForPrompt, formatNotesForPrompt } from "../../knowledge/index.js";

/**
 * guidelineCitations 보수적 적용 원칙. BP·GP task 가 guidelineCitationsLine() 으로만 쓴다.
 * (4) 의 50·67 은 서버 가드 guidelineEffects.LLM_CAP_N_MAX·LLM_CAP_P_MAX 와 같아야 한다.
 */
export const GUIDELINE_CITATION_INSTRUCTION = [
  "아래 원칙으로 보수적으로 판단한다. 목록에 없는 규칙 ID 는 만들지 말 것.",
  "  (1) applied=true 는 규칙의 조건이 산출물 증적에서 명백히·전체적으로 성립할 때만. 부분적으로만 성립하거나(예: 구조화는 돼 있으나 분류 기준이 일부 부족), 추론·가정이 필요하거나, 증적이 없어 판단할 수 없으면 applied=false.",
  "  (2) 상한 규칙(N 상한·P 상한)은 규칙이 말하는 결함이 산출물에 실질적으로 부재할 때만 적용한다. 활동은 수행됐으나 품질·범위가 부족한 경우는 상한이 아니라 weakness finding 과 scorePercent 로 반영한다.",
  "  (3) applied=true 항목의 note 에는 조건이 성립한 구체적 증적(문서 위치와 인용)을 한 문장 이상 적는다. 증적을 적을 수 없으면 applied=false.",
  "  (4) 자신의 scorePercent 와 모순되지 않게 한다: N 상한 규칙을 applied=true 로 하려면 이 항목(BP·GP)을 50 이하(P 이하)로 평가하고 있어야 하고, P 상한 규칙은 67 이하(L- 이하)여야 한다. 더 높게 평가하면서 상한 규칙을 적용하지 말 것.",
  "  (5) 확신이 없으면 applied=false 로 기록하고 note 에 의심 사유를 적는다(기록은 남고 점수는 바뀌지 않는다).",
].join("\n");

export const GUIDELINE_CITATIONS_SCHEMA_LINE =
  `  "guidelineCitations": [{"ruleId": "...", "applied": true|false, "note": "..."}],`;

/** `- pamCitation 은 정확히 "<citation>" 로 작성하라.` */
export function exactCitationLine(citation) {
  return `- pamCitation 은 정확히 "${citation}" 로 작성하라.`;
}

/** `- guidelineCitations: ...` */
export function guidelineCitationsLine() {
  return `- guidelineCitations: ${GUIDELINE_CITATION_INSTRUCTION}`;
}

/** "  1. 텍스트" 줄 목록 (없으면 "  (없음)"). */
export function formatOutcomes(list) {
  const lines = (list ?? []).map((o) => `  ${o.id}. ${o.text}`);
  return lines.length ? lines.join("\n") : "  (없음)";
}

/** 비고 줄 (없으면 빈 배열). */
export function addNotesLines(notes) {
  const lines = (notes ?? []).map((n) => `  ${n}`);
  return lines.length ? ["비고:", ...lines] : [];
}

export function titleWithEn(title, titleEn) {
  return `${title ?? ""}${titleEn ? ` (${titleEn})` : ""}`;
}

/** 가이드라인 규칙·해설 블록 (knowledge.guideline 이 있을 때). */
export function guidelineBlocks(guideline) {
  const rulesText = formatRulesForPrompt(guideline?.rules);
  const notesText = formatNotesForPrompt(guideline?.notes);
  return [
    "# 가이드라인 2026 — 적용 가능한 규칙",
    rulesText || "(해당 규칙 없음)",
    "",
    "# 가이드라인 2026 — 해설",
    notesText || "(해설 없음)",
    "",
  ];
}
