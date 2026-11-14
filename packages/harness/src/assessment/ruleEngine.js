// 가이드라인 조건부 규칙 처리기 (프로세스 비종속, 순수 함수).
//
// 핵심 원칙
//  1. 규칙 "표시"와 "적용 후보 등록"과 "조건 성립"과 "실제 등급 변경"을 구분한다
//     (ruleEvaluation.conditionResult / applicationStatus / beforeRating / afterRating).
//  2. 조건이 FALSE 또는 UNKNOWN 이면 하향·상한 효과를 확정 적용하지 않는다. UNKNOWN 은 검토 대기.
//  3. DOWNRATE_REQUIRED 는 감점 폭을 임의로 정하지 않는다. 심사자 결정(downrateSteps)이 없으면 검토 대기.
//  4. PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON 은 해당 사유에만 적용되며 등급을 올리지 않고 다른 약점도 무효화하지 않는다.
//  5. 등급 의존성(출처 지표 → 대상 지표)은 선언적으로 표현하고 고정점까지 반복 계산한다.
//     항상 "임시 등급(before)"에서 출발하므로 반복 실행해도 추가 감점이 누적되지 않는다(멱등).
//  6. 순환 의존성·양립 불가 제약은 임의 등급으로 풀지 않고 검토 필요(WITHHELD)로 남긴다.
import { selectRulesForBp } from "../knowledge/select.js";
import { requiresReasonJudgment } from "../evaluators/guidelineEffects.js";
import { toOfficial, productGradeOf, minRating, downBy } from "./ratings.js";

/** 규칙 효과를 심사 의미 단위로 분류한다. */
export function classifyEffect(rule) {
  const e = rule?.effect ?? {};
  switch (e.kind) {
    case "cap":
      return e.maxRating === "L"
        ? { type: "EXCLUDE_F", maxRating: "L" }
        : { type: "CAP_AT_RATING", maxRating: e.maxRating };
    case "must-downrate":
      return { type: "DOWNRATE_REQUIRED" };
    case "cap-source":
      return { type: "NOT_HIGHER_THAN_SOURCE" };
    case "must-not-downrate":
      return { type: "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON" };
    default:
      return { type: "MANUAL_REVIEW" };
  }
}

/** "프로젝트와 관련하여 실질적" 같은 중요도 조건을 가진 규칙인지(영문 원문 기준). */
export function requiresSignificance(rule) {
  return /\b(substantial|significant|significantly)\b/i.test(rule?.textEn ?? "");
}

const and3 = (a, b) => (a === "FALSE" || b === "FALSE" ? "FALSE" : a === "TRUE" && b === "TRUE" ? "TRUE" : "UNKNOWN");
const norm3 = (v) => (v === "TRUE" || v === "FALSE" ? v : "UNKNOWN");

function refKey(ref, processId) {
  if (!ref) return null;
  if (ref.kind === "bp") return `${ref.process ?? processId}.${ref.id}`;
  return ref.id;
}

/** 이 프로세스 평가에서 다룰 (규칙, 대상) 쌍을 모은다. */
function collectPairs(processSpec, rules, provisionalKeys) {
  const procId = processSpec.id;
  const byRule = new Map(); // ruleId -> {rule, targets:Set}
  const add = (rule, key) => {
    if (!byRule.has(rule.id)) byRule.set(rule.id, { rule, targets: new Set() });
    byRule.get(rule.id).targets.add(key);
  };
  for (const bp of processSpec.basePractices ?? []) {
    for (const rule of selectRulesForBp(rules, processSpec, bp)) {
      const explicit = (rule.targets ?? []).filter((t) => t.kind === "bp" && (t.process ?? procId) === procId);
      if (explicit.length) {
        // 다중 대상 규칙은 규칙 선택이 BP 단위로 중복 호출돼도 대상 전체를 한 번에 등록한다.
        for (const t of explicit) add(rule, `${procId}.${t.id}`);
      } else add(rule, `${procId}.${bp.id}`); // topic 규칙(TAC 등)은 선택된 BP 자체가 대상
    }
  }
  for (const rule of rules) {
    if (byRule.has(rule.id)) continue;
    const isOwn = rule.scope?.kind === "process" && rule.scope.id === procId;
    const isPa = rule.scope?.kind === "pa";
    if (!isOwn && !isPa) continue;
    for (const t of rule.targets ?? []) {
      if (t.kind === "bp") continue;
      if (provisionalKeys.has(t.id)) add(rule, t.id);
    }
  }
  const pairs = [];
  for (const { rule, targets } of byRule.values()) for (const targetId of targets) pairs.push({ rule, targetId });
  return pairs;
}

/**
 * @param {{
 *   processSpec: {id: string, basePractices: Array<{id: string}>, traceBPs?: string[]},
 *   rules: any[],
 *   provisional: Record<string, string|null>,       // 키: "SUP.10.BP2" 또는 "PA 1.1". 값: N/P/L/F 또는 제품 6단계
 *   conditionInputs?: Record<string, {result?: string, reasonResult?: string, significanceResult?: string,
 *                                     evidenceIds?: string[], significanceEvidenceIds?: string[], reasonKey?: string, rationale?: string}>,
 *   reviewerDecisions?: Record<string, {downrateSteps?: number, reasonKey?: string, rationale?: string}>,
 *   externalRatings?: Record<string, string>,        // 타 프로세스 지표 등급 (교차 프로세스 조건용)
 *   priorEvaluations?: any[],                        // 이전 실행 결과 — 멱등성 보장용(같은 규칙·대상은 처음의 beforeRating 을 유지)
 * }} args
 */
export function evaluateRules({
  processSpec,
  rules,
  provisional,
  conditionInputs = {},
  reviewerDecisions = {},
  externalRatings = {},
  priorEvaluations = [],
}) {
  const procId = processSpec.id;
  const keys = new Set(Object.keys(provisional ?? {}));
  const pairs = collectPairs(processSpec, rules ?? [], keys);

  // 멱등성: 이전 실행에서 이미 기록된 beforeRating 을 우선한다.
  const priorBefore = new Map();
  for (const p of priorEvaluations ?? []) {
    if (p?.ruleId && p?.targetId && p.beforeRating) priorBefore.set(`${p.ruleId}|${p.targetId}`, p.beforeRating);
  }
  const before = {};
  for (const k of keys) before[k] = toOfficial(provisional[k]);
  const beforeFor = (ruleId, targetId) => priorBefore.get(`${ruleId}|${targetId}`) ?? before[targetId] ?? null;

  const finals = { ...before };
  let evals = [];
  let stable = false;
  const maxIter = pairs.length + 5;
  for (let iter = 0; iter < maxIter && !stable; iter++) {
    const pendingByKey = {};
    evals = pairs.map((pair) => evaluatePair(pair, { procId, finals, pendingByKey, conditionInputs, reviewerDecisions, externalRatings, beforeFor, before }));
    // 이번 반복의 보류 목록을 만든 뒤 한 번 더 평가해 조건이 보류 상태를 참조할 수 있게 한다.
    for (const ev of evals) if (ev.applicationStatus === "PENDING_REVIEW" && ev.effectType === "DOWNRATE_REQUIRED" && ev.conditionResult === "TRUE") (pendingByKey[ev.targetId] ??= new Set()).add(ev.ruleId);
    evals = pairs.map((pair) => evaluatePair(pair, { procId, finals, pendingByKey, conditionInputs, reviewerDecisions, externalRatings, beforeFor, before }));
    const next = computeFinals(before, evals);
    stable = keys.size === 0 || [...keys].every((k) => next[k] === finals[k]);
    for (const k of keys) finals[k] = next[k];
  }

  const conflicts = [];
  if (!stable) conflicts.push({ conflictId: "CF-NOT-CONVERGED", kind: "NOT_CONVERGED", ruleIds: [], rationale: "규칙 의존성 계산이 수렴하지 않아 결과를 확정하지 않는다.", resolution: "REVIEW_REQUIRED" });

  detectCycles(evals, conflicts);
  detectImpossible(evals, reviewerDecisions, conflicts);

  const flagged = new Set();
  for (const c of conflicts) {
    for (const id of c.ruleIds) for (const ev of evals) if (ev.ruleId === id) { ev.applicationStatus = "NEEDS_REVIEW"; flagged.add(ev.targetId); }
    for (const t of c.targetIds ?? []) flagged.add(t);
  }

  const ratings = {};
  for (const k of keys) {
    const mine = evals.filter((e) => e.targetId === k);
    const unresolved = [];
    for (const e of mine) {
      if (e.applicationStatus === "PENDING_REVIEW") unresolved.push(`${e.ruleId}: ${e.rationale}`);
      if (e.applicationStatus === "NEEDS_REVIEW") unresolved.push(`${e.ruleId}: 검토 필요 (순환·양립 불가 제약 또는 수동 판단 규칙)`);
    }
    const withheld = flagged.has(k) || before[k] == null;
    ratings[k] = {
      key: k,
      provisional: before[k],
      productGrade: productGradeOf(provisional[k]),
      value: withheld ? null : finals[k],
      status: withheld ? "WITHHELD" : "PROPOSED",
      appliedRuleIds: mine.filter((e) => e.applicationStatus === "APPLIED").map((e) => e.ruleId),
      pendingRuleIds: mine.filter((e) => e.applicationStatus === "PENDING_REVIEW" || e.applicationStatus === "NEEDS_REVIEW").map((e) => e.ruleId),
      unresolvedIssues: unresolved,
    };
  }
  return {
    ruleEvaluations: evals,
    ratings,
    conflicts,
    needsReview: conflicts.length > 0 || evals.some((e) => e.applicationStatus === "PENDING_REVIEW" || e.applicationStatus === "NEEDS_REVIEW"),
  };
}

function resolveSourceRating(src, { procId, finals, pendingByKey, externalRatings }) {
  const key = refKey(src, procId);
  const inScope = key in finals;
  const rating = inScope ? finals[key] : toOfficial(externalRatings[key]);
  return { key, rating: rating ?? null, pending: !!pendingByKey[key]?.size };
}

function evaluatePair({ rule, targetId }, ctx) {
  const { procId, conditionInputs, reviewerDecisions, beforeFor } = ctx;
  const effect = classifyEffect(rule);
  const input = conditionInputs[rule.id] ?? {};
  const cond = rule.condition ?? { kind: "evidence" };
  const evidenceIds = [...(input.evidenceIds ?? [])];

  let result = "UNKNOWN";
  let basis = "";
  if (cond.kind === "rating") {
    const src = resolveSourceRating(cond.source, ctx);
    const when = Array.isArray(cond.when) ? cond.when : [];
    if (src.rating == null) {
      result = "UNKNOWN";
      basis = `출처 지표 ${src.key} 등급을 알 수 없음`;
    } else {
      result = when.includes(src.rating) ? "TRUE" : "FALSE";
      basis = `출처 지표 ${src.key}=${src.rating}, 조건 등급 ${when.join("/")}`;
      // 출처가 하향 검토 대기 중이면 등급이 조건 범위로 내려갈 수 있으므로 FALSE 를 확정하지 않는다.
      if (result === "FALSE" && src.pending) {
        result = "UNKNOWN";
        basis += " (출처 지표가 하향 검토 대기 중)";
      }
    }
    if (cond.reasonQualified || requiresReasonJudgment(rule)) {
      // "…때문에 하향 평가된다면" 형태: 등급만이 아니라 사유도 맞아야 한다.
      result = and3(result, norm3(input.reasonResult));
      basis += `; 사유 조건 ${norm3(input.reasonResult)}`;
    }
  } else {
    result = norm3(input.result);
    basis = input.rationale ?? (result === "UNKNOWN" ? "조건에 대한 검증된 증거 판단이 없음" : "");
  }

  let significance = null;
  if (requiresSignificance(rule)) {
    significance = norm3(input.significanceResult);
    result = and3(result, significance);
    evidenceIds.push(...(input.significanceEvidenceIds ?? []));
  }

  const beforeRating = beforeFor(rule.id, targetId);
  const ev = {
    ruleId: rule.id,
    targetId,
    sourceReference: rule.citation ?? `Guideline ${rule.id}`,
    conditionResult: result,
    conditionEvidenceIds: evidenceIds,
    significanceConditionResult: significance,
    effectType: effect.type,
    applicationStatus: "NOT_EVALUATED",
    beforeRating,
    afterRating: beforeRating,
    rationale: basis,
    dependsOn: cond.kind === "rating" ? [refKey(cond.source, procId)] : [],
  };

  if (beforeRating == null) {
    ev.rationale = `${basis} · 대상 ${targetId} 의 임시 등급이 없어 평가하지 않음`.trim();
    return ev;
  }
  if (result === "FALSE") {
    ev.applicationStatus = "NOT_TRIGGERED";
    ev.rationale = `조건 불성립 → 효과 미적용. ${basis}`.trim();
    return ev;
  }
  if (result === "UNKNOWN") {
    ev.applicationStatus = "PENDING_REVIEW";
    ev.afterRating = null;
    ev.rationale = `조건 미확정(UNKNOWN) → 등급을 변경하지 않고 심사자 확인 대기. ${basis}`.trim();
    return ev;
  }

  // result === "TRUE"
  switch (effect.type) {
    case "EXCLUDE_F":
    case "CAP_AT_RATING": {
      const after = minRating(beforeRating, effect.maxRating);
      ev.afterRating = after;
      ev.applicationStatus = after === beforeRating ? "APPLIED_NO_CHANGE" : "APPLIED";
      ev.rationale = `조건 성립 → ${effect.maxRating} 초과 금지. ${basis}`.trim();
      return ev;
    }
    case "NOT_HIGHER_THAN_SOURCE": {
      const src = resolveSourceRating(rule.condition?.source, ctx);
      if (src.rating == null) {
        ev.applicationStatus = "PENDING_REVIEW";
        ev.afterRating = null;
        ev.rationale = `출처 지표 등급을 알 수 없어 상한을 계산하지 못함`;
        return ev;
      }
      const after = minRating(beforeRating, src.rating);
      ev.afterRating = after;
      ev.applicationStatus = after === beforeRating ? "APPLIED_NO_CHANGE" : "APPLIED";
      ev.rationale = `조건 성립 → 출처 지표 ${src.key}(${src.rating}) 보다 높게 평가 금지. ${basis}`.trim();
      return ev;
    }
    case "DOWNRATE_REQUIRED": {
      const steps = reviewerDecisions[rule.id]?.downrateSteps;
      if (!Number.isInteger(steps) || steps < 1) {
        ev.applicationStatus = "PENDING_REVIEW";
        ev.afterRating = null;
        ev.rationale = `조건 성립 → 하향 필수이나 감점 폭은 심사자 판단 필요(임의 고정하지 않음). ${basis}`.trim();
        return ev;
      }
      ev.afterRating = downBy(beforeRating, steps);
      ev.applicationStatus = ev.afterRating === beforeRating ? "APPLIED_NO_CHANGE" : "APPLIED";
      ev.rationale = `조건 성립 → 심사자 결정 ${steps}단계 하향. ${basis}`.trim();
      return ev;
    }
    case "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON": {
      ev.applicationStatus = "CONSTRAINT_RECORDED";
      ev.afterRating = beforeRating; // 등급을 올리지 않는다. 특정 사유에 의한 하향만 금지한다.
      ev.reasonKey = input.reasonKey ?? rule.id;
      ev.rationale = `조건 성립 → 해당 사유(${ev.reasonKey})로는 하향 금지. 다른 약점의 하향 근거는 유지. ${basis}`.trim();
      return ev;
    }
    default:
      ev.applicationStatus = "NEEDS_REVIEW";
      ev.afterRating = null;
      ev.rationale = `조건 성립 — 효과가 기계적으로 정의되지 않은 규칙이라 심사자 판단 필요. ${basis}`.trim();
      return ev;
  }
}

/** 확정 적용된 효과만 모아 최종 등급을 계산한다. 항상 임시 등급(before)에서 시작한다. */
function computeFinals(before, evals) {
  const out = { ...before };
  for (const k of Object.keys(before)) {
    let v = before[k];
    if (v == null) continue;
    for (const e of evals) {
      if (e.targetId !== k) continue;
      if (e.applicationStatus === "APPLIED" && e.afterRating != null) v = minRating(v, e.afterRating);
    }
    out[k] = v;
  }
  return out;
}

/** 조건이 FALSE 가 아닌 등급 의존 규칙(source → target) 그래프에서 순환(SCC)을 찾는다. 성립(TRUE) 규칙이 낀 순환만 충돌로 본다. */
function detectCycles(evals, conflicts) {
  const live = evals.filter((e) => e.conditionResult !== "FALSE" && e.dependsOn?.length);
  const adj = new Map();
  for (const e of live) for (const s of e.dependsOn) {
    if (!adj.has(s)) adj.set(s, new Set());
    adj.get(s).add(e.targetId);
  }
  const nodes = new Set([...adj.keys(), ...live.map((e) => e.targetId)]);
  let idx = 0;
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], sccs = [];
  const strong = (v) => {
    index.set(v, idx); low.set(v, idx); idx++; stack.push(v); onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const v of nodes) if (!index.has(v)) strong(v);
  for (const comp of sccs) {
    const set = new Set(comp);
    const selfLoop = comp.length === 1 && adj.get(comp[0])?.has(comp[0]);
    if (comp.length < 2 && !selfLoop) continue;
    const inside = live.filter((e) => set.has(e.targetId) && e.dependsOn.some((s) => set.has(s)));
    if (!inside.some((e) => e.conditionResult === "TRUE")) continue;
    conflicts.push({
      conflictId: `CF-CYCLE-${comp.slice().sort().join("+")}`,
      kind: "CIRCULAR_RULE_DEPENDENCY",
      ruleIds: [...new Set(inside.map((e) => e.ruleId))],
      targetIds: comp,
      rationale: "등급 의존 규칙이 순환한다. 임의 등급으로 풀지 않고 검토 필요로 남긴다.",
      resolution: "REVIEW_REQUIRED",
    });
  }
}

function detectImpossible(evals, reviewerDecisions, conflicts) {
  const byTarget = new Map();
  for (const e of evals) {
    if (e.conditionResult !== "TRUE") continue;
    if (!byTarget.has(e.targetId)) byTarget.set(e.targetId, []);
    byTarget.get(e.targetId).push(e);
  }
  for (const [targetId, list] of byTarget) {
    const prohibits = list.filter((e) => e.effectType === "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON");
    for (const p of prohibits) {
      for (const d of list.filter((e) => e.effectType === "DOWNRATE_REQUIRED")) {
        const dReason = reviewerDecisions[d.ruleId]?.reasonKey ?? d.ruleId;
        if (dReason === p.reasonKey) {
          conflicts.push({
            conflictId: `CF-IMPOSSIBLE-${p.ruleId}-${d.ruleId}`,
            kind: "IMPOSSIBLE_CONSTRAINT",
            ruleIds: [p.ruleId, d.ruleId],
            targetIds: [targetId],
            rationale: `같은 사유(${dReason})에 대해 하향 필수(${d.ruleId})와 하향 금지(${p.ruleId})가 동시에 성립한다. 임의 등급으로 풀지 않는다.`,
            resolution: "REVIEW_REQUIRED",
          });
        }
      }
    }
  }
}
