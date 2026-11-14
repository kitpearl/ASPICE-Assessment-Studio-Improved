import { unionStandardReferences } from "./findingBuilders.js";
import { applyAppliedRules } from "./guidelineEffects.js";
import { getGuidelineRulesById } from "./guidelineRules.js";

/**
 * HybridScorer — weighted fusion of rule and llm scores (default 40/60).
 *
 * Abstention handling: if either scorer throws or returns score=0 with a
 * `gaps` entry explicitly mentioning "rejected"/"failed", the remaining
 * scorer's result is used directly (no weighting dilution).
 *
 * Evidence and gaps from both scorers are concatenated so the final report
 * retains both the deterministic rule trace and the LLM narrative.
 *
 * Project-context: each scorer may attach a `contextConsistency` field. The
 * hybrid result reconciles them — the more decisive verdict wins (off-context
 * > partial > consistent > unknown), so a worry from either side is preserved.
 *
 * @param {{
 *   rule: import("./scorer.js").Scorer,
 *   llm: import("./scorer.js").Scorer,
 *   weights?: {rule: number, llm: number}
 * }} opts
 * @returns {import("./scorer.js").Scorer}
 */
export function createHybridScorer({ rule, llm, weights = { rule: 0.4, llm: 0.6 } }) {
  if (!rule || !llm) throw new Error("HybridScorer requires both `rule` and `llm` scorers");
  return {
    scoreBP: merge("scoreBP", rule, llm, weights),
    scoreWP: merge("scoreWP", rule, llm, weights),
    scoreGP: merge("scoreGP", rule, llm, weights),
  };
}

const CONTEXT_PRIORITY = { "off-context": 3, partial: 2, consistent: 1, unknown: 0 };

function reconcileContext(ruleCtx, llmCtx) {
  const r = ruleCtx ?? { status: "unknown", note: "" };
  const l = llmCtx ?? { status: "unknown", note: "" };
  // Prefer the more decisive (worse) status. Ties go to the LLM since it has
  // the richer signal (semantic comparison vs. term-set comparison).
  const rPrio = CONTEXT_PRIORITY[r.status] ?? 0;
  const lPrio = CONTEXT_PRIORITY[l.status] ?? 0;
  if (rPrio > lPrio) return r;
  if (lPrio > rPrio) return l;
  return l.status !== "unknown" ? l : r;
}

function merge(method, rule, llm, weights) {
  return async function combined(ctx) {
    const [r, l] = await Promise.allSettled([rule[method](ctx), llm[method](ctx)]);
    const ruleRes = r.status === "fulfilled" ? r.value : abstain(`rule threw: ${r.reason?.message}`);
    const llmRes = l.status === "fulfilled" ? l.value : abstain(`llm threw: ${l.reason?.message}`);

    const ruleOk = !isAbstention(ruleRes);
    const llmOk = !isAbstention(llmRes);

    let scorePercent;
    if (ruleOk && llmOk) {
      scorePercent = Math.round(ruleRes.scorePercent * weights.rule + llmRes.scorePercent * weights.llm);
    } else if (ruleOk) scorePercent = ruleRes.scorePercent;
    else if (llmOk) scorePercent = llmRes.scorePercent;
    else scorePercent = 0;

    // Findings 병합: LLM (가능하면 의미적 weakness/strength) 을 먼저 두고
    // Rule (observation) 을 뒤에 붙여 시니어가 두 시그널을 한 곳에서 비교할 수
    // 있게 한다. id 충돌이 거의 없도록 prefix 가 다르지만 (F-rule-, F-...
    // vs F-SWE.2.BP1-01) 중복 제거 로직은 두지 않아 양쪽 진술을 모두 보존한다.
    const findings = [...(llmRes.findings ?? []), ...(ruleRes.findings ?? [])];
    const standardReferences = unionStandardReferences(
      ruleRes.standardReferences,
      llmRes.standardReferences
    );
    const result = {
      scorePercent,
      // LLM evidence first: it produces full-sentence quotes with location/citation.
      // Rule evidence (keyword snippets) is supplementary and gets clipped by the
      // legacy adapter's slice(0, N) — putting it second keeps the richer quotes.
      evidence: [...(llmRes.evidence ?? []), ...(ruleRes.evidence ?? [])],
      gaps: [
        ...(ruleRes.gaps ?? []).map((g) => `[rule] ${g}`),
        ...(llmRes.gaps ?? []).map((g) => `[llm] ${g}`),
      ],
      pamCitation: llmRes.pamCitation,
      contextConsistency: reconcileContext(ruleRes.contextConsistency, llmRes.contextConsistency),
      standardReferences,
      findings,
    };
    // 가이드라인 상한이 적용되기 전의 융합 점수(검증되지 않은 LLM 규칙 주장이 점수에 반영되기 전 값)
    const llmUncapped = llmRes.scoreBeforeGuidelineCaps ?? llmRes.scorePercent;
    const uncappedFused = ruleOk && llmOk ? Math.round(ruleRes.scorePercent * weights.rule + llmUncapped * weights.llm) : ruleOk ? ruleRes.scorePercent : llmOk ? llmUncapped : 0;
    // 가이드라인 상한은 LLM 이 적용 판단한 규칙 기준. 융합 후 재적용해 rule 점수가
    // 상한을 끌어올리지 못하게 한다 (상한 gap 은 이미 [llm] 쪽에 있으므로 복사본에 적용).
    // 반환하는 appliedRules 는 capped 표시를 합친 복사본 (LLM 단계 또는 융합 단계에서 상한 적용).
    result.appliedRules = recapAppliedRules(result, llmRes.appliedRules);
    if (uncappedFused > result.scorePercent) result.scoreBeforeGuidelineCaps = uncappedFused;
    const references = llmRes.references ?? ruleRes.references;
    if (references) result.references = references;
    return result;
  };
}

/**
 * 융합 점수에 가이드라인 상한을 재적용하고, capped 플래그를 합친 appliedRules 복사본을 돌려준다.
 * result.scorePercent / result.gaps 는 상한이 걸리면 갱신된다.
 * @param {{scorePercent: number, gaps: string[]}} result
 * @param {any[]|undefined} llmApplied
 * @returns {any[]}
 */
export function recapAppliedRules(result, llmApplied) {
  if (!Array.isArray(llmApplied) || !llmApplied.length) return [];
  const appliedRules = llmApplied.map((e) => ({ ...e }));
  // 복사본은 capped 를 지운 상태로 재평가해 융합 단계의 상한 여부만 기록되게 한다
  for (const e of appliedRules) if (e) delete e.capped;
  const capped = applyAppliedRules({ scorePercent: result.scorePercent, gaps: [], appliedRules }, getGuidelineRulesById());
  if (capped.scorePercent < result.scorePercent) {
    result.scorePercent = capped.scorePercent;
    if (!result.gaps.some((g) => g.includes("가이드라인 ["))) result.gaps.push(...capped.gaps);
  }
  return appliedRules.map((e, i) => {
    if (!e) return e;
    const llmCapped = llmApplied[i]?.capped === true;
    const fusedCapped = e.capped === true;
    const out = { ...e };
    if (llmCapped || fusedCapped) out.capped = true;
    return out;
  });
}

function isAbstention(r) {
  if (!r) return true;
  const gaps = r.gaps ?? [];
  return gaps.some((g) => /rejected|failed|threw/.test(g));
}

function abstain(reason) {
  return {
    scorePercent: 0,
    evidence: [],
    gaps: [`rejected: ${reason}`],
    contextConsistency: { status: "unknown", note: "" },
    standardReferences: { pam: [], pamNote: [], bgbRL: [], iso: [] },
    findings: [],
  };
}
