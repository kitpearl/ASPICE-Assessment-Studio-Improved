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

// 화면용 상한 라벨(효과 → "상한 N"). 칩 라벨(EFFECT_LABEL)과 어순이 달라 별도로 둔다.
const CAP_LABEL = { "cap:N": "상한 N", "cap:P": "상한 P", "cap:L": "상한 L", "must-downrate": "상한 L", "cap-source": "출처 등급 상한" };

// capped 된 appliedRules 를 화면용으로 정리한다. 반환: [{ id, capLabel, source, note }]
// source: 룰 엔진(후처리) 또는 LLM 판단. 보류된 항목(applied=false)과 capped 아닌 항목은 제외한다.
export const cappedRules = (references, appliedRules) => {
  const effects = new Map(guidelineList(references).map((g) => [g.id, g.effect]));
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(appliedRules) ? appliedRules : []) {
    if (!r || !r.ruleId || !r.capped || r.applied === false || seen.has(r.ruleId)) continue;
    seen.add(r.ruleId);
    out.push({
      id: r.ruleId,
      capLabel: CAP_LABEL[effects.get(r.ruleId)] || "등급 상한",
      source: r.source === "rule-engine" ? "규칙 엔진" : "LLM 판단",
      note: typeof r.note === "string" ? r.note : "",
    });
  }
  return out;
};

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
