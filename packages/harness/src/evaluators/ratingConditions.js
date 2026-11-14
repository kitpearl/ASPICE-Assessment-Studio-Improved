// 가이드라인 2026 등급 조건 규칙(condition.kind === "rating")의 결정론적 후처리 (순수 함수).
// 출처 지표의 등급이 when(N/P)에 들면 대상 지표의 점수를 상한까지만 낮춘다. 올리지 않는다.
// crossProcess 규칙과 이 프로세스 결과로 출처·대상을 찾을 수 없는 규칙은 건너뛴다.
// 사유 한정 규칙은 사유를 검증할 수 없으므로 적용하지 않고 unverifiedReason 으로 돌려준다.
import { capForEffect, capLabel, requiresReasonJudgment } from "./guidelineEffects.js";
import { percentToRating, collapse } from "../model/rating.js";

/**
 * @param {{processId: string, bps: any[], pas: any[], rules: any[]}} args
 * @returns {{bps: any[], pas: any[], applied: Array<{ruleId: string, target: string, sourceRating: string}>, unverifiedReason: Array<{ruleId: string, source: string, sourceRating: string}>}}
 */
export function applyRatingConditionRules({ processId, bps = [], pas = [], rules = [] }) {
  const applied = [];
  // 사유 한정 규칙("…때문에 P/N 이라면")은 출처 지표의 등급만으로 성립을 확인할 수 없다.
  // 사유를 검증하지 않고 하향하면 오적용이므로 자동 적용하지 않고 검토 대기로 남긴다.
  const unverifiedReason = [];
  for (const rule of rules ?? []) {
    const cond = rule?.condition;
    if (!cond || cond.kind !== "rating" || cond.crossProcess) continue;
    const when = Array.isArray(cond.when) ? cond.when : [];
    const source = resolveSource(cond.source, processId, bps, pas);
    if (!source) continue;
    const sourceRating = safeCollapse(source.rating);
    if (!sourceRating || !when.includes(sourceRating)) continue;
    if (requiresReasonJudgment(rule)) {
      unverifiedReason.push({ ruleId: rule.id, source: source.id, sourceRating });
      continue;
    }
    const cap = capForEffect(rule.effect, source.percent);
    if (cap === null) continue;
    const targets = (rule.targets ?? []).map((t) => resolveTarget(t, processId, bps, pas));
    if (!targets.length || targets.some((t) => !t)) continue;
    for (const target of targets) {
      if (alreadyApplied(target, rule.id)) continue;
      if (!clampTarget(target, cap)) continue;
      const entry = {
        ruleId: rule.id,
        applied: true,
        note: `${source.id} ${sourceRating}`,
        source: "rule-engine",
        capped: true,
      };
      const gap = `가이드라인 [${rule.id}] 적용: ${source.id}가 ${sourceRating}이므로 상한 ${capLabel(rule.effect, source.id)}`;
      recordOn(target, entry, gap);
      applied.push({ ruleId: rule.id, target: target.id, sourceRating });
    }
  }
  return { bps, pas, applied, unverifiedReason };
}

function safeCollapse(rating) {
  try {
    return collapse(rating);
  } catch {
    return null;
  }
}

function bpInScope(ref, processId) {
  return ref.process === undefined || ref.process === processId;
}

function findGp(pas, gpId) {
  for (const pa of pas) {
    const gp = (pa.gps ?? []).find((g) => g.id === gpId);
    if (gp) return { pa, gp };
  }
  return null;
}

function paPercent(pa) {
  const gps = pa.gps ?? [];
  if (!gps.length) return undefined;
  return gps.reduce((s, g) => s + (g.scorePercent ?? 0), 0) / gps.length;
}

function resolveSource(src, processId, bps, pas) {
  if (!src) return null;
  if (src.kind === "bp") {
    if (!bpInScope(src, processId)) return null;
    const bp = bps.find((b) => b.id === src.id);
    return bp ? { id: src.id, rating: bp.rating, percent: bp.scorePercent } : null;
  }
  if (src.kind === "gp") {
    const hit = findGp(pas, src.id);
    return hit ? { id: src.id, rating: hit.gp.rating, percent: hit.gp.scorePercent } : null;
  }
  if (src.kind === "pa") {
    const pa = pas.find((p) => p.paId === src.id);
    return pa ? { id: src.id, rating: pa.rating, percent: paPercent(pa) } : null;
  }
  return null;
}

function resolveTarget(t, processId, bps, pas) {
  if (!t) return null;
  if (t.kind === "bp") {
    if (!bpInScope(t, processId)) return null;
    const bp = bps.find((b) => b.id === t.id);
    return bp ? { kind: "bp", id: t.id, item: bp } : null;
  }
  if (t.kind === "gp") {
    const hit = findGp(pas, t.id);
    return hit ? { kind: "gp", id: t.id, item: hit.gp, pa: hit.pa } : null;
  }
  if (t.kind === "pa") {
    const pa = pas.find((p) => p.paId === t.id);
    return pa ? { kind: "pa", id: t.id, item: pa, pa } : null;
  }
  return null;
}

// 이 후처리기가 직접 남긴 항목만 본다. 스코어러(LLM)가 남긴 같은 ruleId 항목은 무시한다.
function alreadyApplied(target, ruleId) {
  const list = target.item.appliedRules;
  return Array.isArray(list) && list.some((e) => e?.ruleId === ruleId && e?.source === "rule-engine");
}

function clampItem(item, cap) {
  if (!(item.scorePercent > cap)) return false;
  item.scorePercent = cap;
  item.rating = percentToRating(cap);
  return true;
}

function refreshPa(pa) {
  const avg = paPercent(pa);
  if (avg === undefined) return;
  pa.rating = percentToRating(avg);
  pa.collapsed = collapse(pa.rating);
}

// 점수가 실제로 낮아졌을 때만 true
function clampTarget(target, cap) {
  if (target.kind === "pa") {
    const pa = target.item;
    const current = paPercent(pa);
    if (current === undefined || !(current > cap)) return false;
    for (const gp of pa.gps) clampItem(gp, cap);
    refreshPa(pa);
    return true;
  }
  const changed = clampItem(target.item, cap);
  if (changed && target.kind === "gp") refreshPa(target.pa);
  return changed;
}

function recordOn(target, entry, gap) {
  const item = target.item;
  if (!Array.isArray(item.appliedRules)) item.appliedRules = [];
  item.appliedRules.push(entry);
  // PA 는 gaps 가 없으므로 첫 GP 에 근거 문구를 남긴다
  const gapHolder = target.kind === "pa" ? item.gps?.[0] : item;
  if (gapHolder) {
    if (!Array.isArray(gapHolder.gaps)) gapHolder.gaps = [];
    gapHolder.gaps.push(gap);
    // PA 대상이면 근거 문구를 가진 GP 에도 적용 항목을 남겨 칩 표시를 맞춘다
    if (gapHolder !== item) {
      if (!Array.isArray(gapHolder.appliedRules)) gapHolder.appliedRules = [];
      gapHolder.appliedRules.push({ ...entry });
    }
  }
}
