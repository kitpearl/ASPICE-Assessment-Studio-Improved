// Finding 표시 로직을 화면(VerdictCard)과 텍스트 export(exportReport)가
// 공유한다. PDF 는 VerdictCard 를 그대로 캡처하므로, 텍스트 결과물이 PDF 와
// 동일한 내용을 담으려면 같은 헬퍼를 써야 한다.

import { normalizeEvidence } from "./evidence";

// Finding type → 한글 라벨. VerdictCard 는 여기에 색상을 덧붙여 카드를 그리고,
// 텍스트 export 는 라벨만 사용한다.
export const FINDING_TYPE_LABEL = {
  weakness: "약점 (WEAKNESS)",
  strength: "강점 (STRENGTH)",
  observation: "관찰 (OBSERVATION)",
};

// BGB Rating Rule 인용은 형식이 [<scope>.RL.<n>] 이다 (예: [MAN.3.RL.8]).
// 근거 증적에는 현재 평가 중인 프로세스 영역(processId, 예: "MAN.3")에 해당하는
// 규칙만 노출한다 — 타 프로세스(GEN/DEX/APA 등)에서 교차 참조된 규칙은 평가자의
// 초점을 흐리므로 제외한다. processId 가 없으면(레거시 호출) 필터하지 않는다.
export const scopeBgbRefs = (bgbRL, processId) => {
  if (!Array.isArray(bgbRL)) return [];
  if (!processId) return bgbRL;
  const prefix = `[${processId}.RL.`;
  return bgbRL.filter((r) => typeof r === "string" && r.startsWith(prefix));
};

// 표준 인용(PAM / PAM Note / BGB / INCOSE) 을 {kind, text} 리스트로 평탄화한다.
// ISO 근거(refs.iso)는 BP 평가에서 제외한다 (요청): PAM·BGB 만 노출.
// INCOSE GtWR 인용(refs.incose)은 요구사항 분석 프로세스(SYS.2/SWE.1/HWE.1)에서만
// 채워지므로 별도 스코프 필터 없이 그대로 노출한다.
export const flattenStandardRefs = (refs, processId) => {
  if (!refs) return [];
  return [
    ...(refs.pam ?? []).map((r) => ({ kind: "PAM", text: r })),
    ...(refs.pamNote ?? []).map((r) => ({ kind: "Note", text: r })),
    ...scopeBgbRefs(refs.bgbRL, processId).map((r) => ({ kind: "BGB", text: r })),
    // 표시용 텍스트는 선행 "INCOSE " 접두어를 떼어 kind 배지("INCOSE")와의 중복을
    // 피한다 (예: 인용 "INCOSE GtWR C7" → 배지 INCOSE + 텍스트 "GtWR C7").
    ...(refs.incose ?? []).map((r) => ({ kind: "INCOSE", text: String(r).replace(/^INCOSE\s+/, "") })),
  ];
};

// 증적(quote) 원문을 그대로 덤프하지 않고, Finding 의 서술 슬롯
// (situation → gap → impact) 을 한 문단으로 엮어 "무엇을 발견했는지" 를 진술한다.
// 서술 슬롯이 모두 비어 있는 레거시/덤프형 데이터는 evidence quote 로 폴백한다.
export const buildFindingNarrative = (finding) => {
  const parts = [finding.situation, finding.gap, finding.impact]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return normalizeEvidence(finding.evidence ?? [])
    .map((e) => e.quote)
    .filter(Boolean)
    .join(" ");
};
