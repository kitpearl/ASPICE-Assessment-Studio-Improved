// 가이드라인 규칙 선택 순수 함수. 로더에 의존하지 않는다.

export const MAX_RULES = 12;
export const SUMMARY_CHARS = 80;

// 명시 target으로 포함될 때 "조건부"로 표시하는 topic scope
const CONDITIONAL_TOPICS = new Set(["MBD", "AGE", "DEX", "APA"]);

function isTopic(rule, topicId) {
  return rule.scope?.kind === "topic" && (topicId === undefined || rule.scope.id === topicId);
}

// 프로세스/PA scope 먼저(파일 순서 유지), 그다음 topic; MAX_RULES 절단
export function orderAndCut(rules, max = MAX_RULES) {
  const own = rules.filter((r) => !isTopic(r));
  const topic = rules.filter((r) => isTopic(r));
  return [...own, ...topic].slice(0, max);
}

function targetsBp(rule, processId, bpId) {
  return (rule.targets ?? []).some((t) => t.kind === "bp" && t.process === processId && t.id === bpId);
}

export function selectRulesForBp(rules, process, bp) {
  if (!process || !bp) return [];
  const isTrace = (process.traceBPs ?? []).includes(bp.id);
  const isCommunicate = /의사소통/.test(bp.title ?? "");
  const picked = rules.filter((r) => {
    if (targetsBp(r, process.id, bp.id)) return true;
    if (isTrace && isTopic(r, "TAC")) return true;
    if (isCommunicate && isTopic(r, "COM")) return true;
    return false;
  });
  return orderAndCut(picked);
}

export function selectRulesForGp(rules, paId, gpId, processId = null) {
  const picked = rules.filter((r) => {
    // 프로세스 scope 규칙은 해당 프로세스의 GP 에만 포함한다
    if (r.scope?.kind === "process" && !(processId && r.scope.id === processId)) return false;
    const targets = r.targets ?? [];
    if (targets.some((t) => t.kind === "gp" && t.id === gpId)) return true;
    if (targets.some((t) => t.kind === "pa" && t.id === paId)) return true;
    if (targets.length === 0 && r.scope?.kind === "pa" && r.scope.id === paId) return true;
    if (paId === "PA 1.1" && isTopic(r, "GEN")) return true;
    return false;
  });
  return orderAndCut(picked);
}

export function selectRulesForProcess(rules, processId) {
  return rules.filter((r) => r.scope?.kind === "process" && r.scope.id === processId).slice(0, MAX_RULES);
}

// 규칙이 명시 target 경로로 포함된 topic(MBD/AGE/DEX/APA)이면 그 topic id, 아니면 undefined
export function conditionalTopicOf(rule) {
  if (!isTopic(rule) || !CONDITIONAL_TOPICS.has(rule.scope.id)) return undefined;
  return (rule.targets ?? []).length > 0 ? rule.scope.id : undefined;
}

export function effectString(effect) {
  if (!effect) return "other";
  if (effect.kind === "cap") return effect.maxRating ? `cap:${effect.maxRating}` : "other";
  if (["cap-source", "must-downrate", "must-not-downrate"].includes(effect.kind)) return effect.kind;
  return "other";
}

export function truncate(text, max) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function toReference(rule, { conditional } = {}) {
  const ref = {
    id: rule.id,
    effect: effectString(rule.effect),
    section: rule.section,
    page: rule.page,
    summary: truncate(rule.text, SUMMARY_CHARS),
  };
  if (conditional) ref.conditional = conditional;
  if (rule.condition?.crossProcess) ref.displayOnly = true;
  return ref;
}
