// 세 프롬프트 빌더가 공유하는 문구·블록 조립기.
import { formatRulesForPrompt, formatNotesForPrompt } from "../../knowledge/index.js";

export const GUIDELINE_CITATION_INSTRUCTION =
  "규칙은 조건이 증적에서 성립할 때만 applied=true. 성립하지 않으면 넣지 말거나 applied=false. 목록에 없는 규칙 ID를 만들지 말 것.";

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
