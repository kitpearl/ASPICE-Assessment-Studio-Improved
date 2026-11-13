// 평가 근거(PAM 4.1 인용, 가이드라인 3판 규칙) 표시용 공용 포맷터.
// ReferenceChips(화면)와 텍스트·HTML 내보내기가 같은 문자열을 쓰도록 한 곳에 둔다.

export const EFFECT_LABEL = {
  "cap:N": "N 상한",
  "cap:P": "P 상한",
  "cap:L": "L 상한",
  "cap-source": "출처 등급 상한",
  "must-downrate": "하향 필수",
  "must-not-downrate": "하향 금지",
  other: "참고",
};

export const effectLabel = (effect) => EFFECT_LABEL[effect] || EFFECT_LABEL.other;

// PAM 칩 문자열: "PAM 4.1 §4.4.1 SWE.1.BP2 · p.50"
export const formatPam = (pam) => {
  if (!pam?.citation) return "";
  return pam.page != null && pam.page !== "" ? `${pam.citation} · p.${pam.page}` : pam.citation;
};

// appliedRules 중 이 규칙으로 실제 등급 상한이 걸린 항목을 찾는다.
export const findCappedRule = (ruleId, appliedRules) =>
  (Array.isArray(appliedRules) ? appliedRules : []).find(
    (r) => r && r.ruleId === ruleId && r.capped && r.applied !== false,
  );

// 가이드라인 칩 문자열: "[SWE.1.RL.4] N 상한 (MBD)"
export const formatGuideline = (g) => {
  if (!g?.id) return "";
  const suffix = g.conditional ? ` (${g.conditional})` : "";
  return `[${g.id}] ${effectLabel(g.effect)}${suffix}`;
};

export const guidelineList = (references) =>
  Array.isArray(references?.guideline) ? references.guideline.filter((g) => g?.id) : [];

// 한 줄 요약: "PAM 4.1 §… · p.50 · [SWE.1.RL.4] N 상한(적용) · [SWE.1.RC.2] 참고(타 프로세스 조건)"
// pamSep: PAM 인용과 가이드라인 목록 사이 구분자(텍스트 내보내기는 " / ").
export const referencesToText = (references, appliedRules, { pamSep = " · " } = {}) => {
  if (!references) return "";
  const pam = formatPam(references.pam);
  const rules = guidelineList(references).map((g) => {
    let s = formatGuideline(g);
    if (findCappedRule(g.id, appliedRules)) s += "(적용)";
    else if (g.displayOnly) s += "(타 프로세스 조건)";
    return s;
  });
  const ruleText = rules.join(" · ");
  if (pam && ruleText) return `${pam}${pamSep}${ruleText}`;
  return pam || ruleText;
};
