// 세 프롬프트 빌더가 공유하는 문구·블록 조립기.
import { formatRulesForPrompt, formatNotesForPrompt } from "../../knowledge/index.js";

export const SYSTEM_PREFIX =
  "You are a qualified Automotive SPICE PAM 4.1 assessor applying the VDA Automotive SPICE Guidelines 3rd Edition (2026).";

export const LANGUAGE_AND_QUOTE_RULES =
  'All natural-language fields ("gaps", "evidence[].quote", "contextConsistency.note", "guidelineCitations[].note") MUST be written in Korean (한국어). PAM citations and identifiers stay as-is. Each "evidence[].quote" MUST be a verbatim, COMPLETE passage from the source — include the surrounding sentences so the reader has full context. Never truncate mid-sentence or mid-word, never abbreviate with "…", and prefer 2–6 contiguous sentences (typically 300–800 characters) over a one-line snippet.';

export const GUIDELINE_CITATION_INSTRUCTION =
  "규칙은 조건이 증적에서 성립할 때만 applied=true. 성립하지 않으면 넣지 말거나 applied=false. 목록에 없는 규칙 ID를 만들지 말 것.";

/** 가이드라인 규칙·해설 블록 (knowledge.guideline 이 있을 때). */
export function guidelineBlocks(guideline) {
  const rulesText = formatRulesForPrompt(guideline?.rules);
  const notesText = formatNotesForPrompt(guideline?.notes);
  return [
    "## 가이드라인 2026 — 적용 가능한 규칙",
    rulesText || "(해당 규칙 없음)",
    "",
    "## 가이드라인 2026 — 해설",
    notesText || "(해설 없음)",
    "",
  ];
}

/** 응답 JSON 스키마 줄. withGuideline 이면 guidelineCitations 필드를 추가한다. */
export function jsonSchemaLines({ withLocation = false, withGuideline = false } = {}) {
  const evidence = withLocation
    ? `  "evidence": [{"artifactName": "...", "quote": "...", "location": "..."}],`
    : `  "evidence": [{"artifactName": "...", "quote": "..."}],`;
  const lines = [
    `Return JSON ONLY:`,
    `{`,
    `  "scorePercent": <0-100>,`,
    evidence,
    `  "gaps": ["..."],`,
    withGuideline ? `  "pamCitation": "PAM 4.1 §...",` : `  "pamCitation": "PAM §...",`,
  ];
  if (withGuideline) {
    lines.push(`  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." },`);
    lines.push(`  "guidelineCitations": [{"ruleId": "...", "applied": true|false, "note": "..."}]`);
  } else {
    lines.push(`  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." }`);
  }
  lines.push(`}`);
  return lines;
}
