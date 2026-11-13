import { buildBpPrompt } from "../llm/prompts/bpPrompt.js";
import { buildWpPrompt } from "../llm/prompts/wpPrompt.js";
import { buildGpPrompt } from "../llm/prompts/gpPrompt.js";
import { buildExcerpt, extractKeywords } from "../io/excerpt.js";
import { fingerprintForPrompt } from "../io/projectContext.js";
import { validateLlmResult } from "./citationGuard.js";
import { applyAppliedRules, guardLlmCitations } from "./guidelineEffects.js";
import { getGuidelineRulesById } from "./guidelineRules.js";
import * as defaultKnowledge from "../knowledge/index.js";

// Safety-net multiplier applied AFTER the LLM's own verdict. The assessor is
// instructed to lower scorePercent itself when it flags partial/off-context
// evidence, but we also apply a cap here so the numeric score can never
// silently drift back up if the LLM forgets to follow the rule.
//
// 점수를 여유있게 부여하라는 요청에 맞춰 페널티를 완화했다 (정성적 컨텍스트
// 우선): partial 0.85→0.95, off-context 0.6→0.8. 컨텍스트 불일치 사유는
// 여전히 gaps/note 로 남아 시니어 평가자가 확인할 수 있다.
const CONTEXT_MULTIPLIERS = {
  consistent: 1.0,
  unknown: 1.0,
  partial: 0.95,
  "off-context": 0.8,
};

// 전체 규칙 ID 집합 (항목 지식이 없을 때 knownRuleIds 대체값)
let _allRuleIds;
function allRuleIds() {
  if (!_allRuleIds) _allRuleIds = new Set(getGuidelineRulesById().keys());
  return _allRuleIds;
}

// ctx.bp / ctx.gp / ctx.wp 에 따라 항목 지식을 조회한다. 실패하면 null.
function lookupKnowledge(knowledge, ctx) {
  const processId = ctx.process?.id;
  try {
    if (ctx.bp) return knowledge.getBpKnowledge?.(processId, ctx.bp.id) ?? null;
    if (ctx.gp) return knowledge.getGpKnowledge?.(ctx.paSpec?.id, ctx.gp.id, processId) ?? null;
    if (ctx.wp) return knowledge.getWpKnowledge?.(processId, ctx.wp.id) ?? null;
  } catch (err) {
    console.warn("[aspice/llm] knowledge lookup failed:", err.message);
  }
  return null;
}

/**
 * LlmScorer — single-shot assessor scorer that calls a provider-agnostic
 * LLM client and validates the response (JSON shape + PAM citation).
 * Malformed responses degrade gracefully: score=0, gap noted.
 *
 * `knowledge` defaults to the PAM 4.1 / Guideline 2026 getters in
 * src/knowledge (injectable for tests). Guideline rules the LLM marks as
 * applied are enforced via applyAppliedRules AFTER the context multiplier.
 *
 * @param {{client: import("../llm/client.js").LlmClient, knowledge?: any}} opts
 * @returns {import("./scorer.js").Scorer}
 */
export function createLlmScorer({ client, knowledge = defaultKnowledge }) {
  if (!client) throw new Error("LlmScorer requires an LLM client");

  async function call(buildFn, ctx, keywords) {
    const excerpt = buildExcerpt({
      artifacts: ctx.artifacts ?? [],
      keywords,
    });
    const projectFingerprint = fingerprintForPrompt(ctx.projectFingerprint);
    const k = knowledge ? lookupKnowledge(knowledge, ctx) : null;
    const references = k?.references ?? undefined;
    const prompt = buildFn({ ...ctx, artifactsExcerpt: excerpt, projectFingerprint, knowledge: k });
    let raw;
    try {
      const { parsed } = await client.generateJson(prompt);
      raw = parsed;
    } catch (err) {
      console.warn("[aspice/llm] call failed:", err.message);
      return fallback(`LLM call failed: ${err.message}`, undefined, references);
    }
    const knownRuleIds = Array.isArray(k?.guideline?.rules)
      ? new Set(k.guideline.rules.map((r) => r.id))
      : allRuleIds();
    const v = validateLlmResult(raw, { knownRuleIds });
    if (!v.ok) {
      console.warn("[aspice/llm] response rejected:", v.reason, "— pamCitation:", raw?.pamCitation, "evidenceCount:", Array.isArray(raw?.evidence) ? raw.evidence.length : 0);
      return fallback(v.reason, raw, references);
    }
    const { contextConsistency, standardReferences, findings, droppedFindings, droppedRefs } = v.result;
    if (droppedRefs.length > 0) {
      console.warn("[aspice/llm] dropped malformed standardReferences:", droppedRefs.join(", "));
    }
    if (droppedFindings.length > 0) {
      console.warn("[aspice/llm] dropped malformed findings:", droppedFindings.join(", "));
    }
    // LLM 원점수(컨텍스트 배수 적용 전)와 모순되거나 근거가 없는 적용 판단은 보류(applied=false)한다.
    // 점수·gap 은 바뀌지 않고 note 에 "[보류: 사유]" 접두만 남긴다.
    const rulesById = getGuidelineRulesById();
    const citations = guardLlmCitations(v.result.scorePercent, v.result.appliedRules, rulesById);
    const multiplier = CONTEXT_MULTIPLIERS[contextConsistency.status] ?? 1.0;
    const adjustedScore = Math.round(v.result.scorePercent * multiplier);
    const gaps = [...v.result.gaps];
    if (contextConsistency.status === "off-context") {
      gaps.push(`프로젝트 컨텍스트 불일치: ${contextConsistency.note || "다른 제품/프로젝트의 자료로 판단됨"}`);
    } else if (contextConsistency.status === "partial") {
      gaps.push(`프로젝트 컨텍스트 부분 일치: ${contextConsistency.note || "일부 산출물이 다른 컨텍스트로 보임"}`);
    }
    const result = {
      scorePercent: adjustedScore,
      evidence: v.result.evidence,
      gaps,
      pamCitation: v.result.pamCitation,
      contextConsistency,
      standardReferences,
      findings,
      appliedRules: citations,
    };
    applyAppliedRules(result, rulesById);
    if (references) result.references = references;
    return result;
  }

  return {
    async scoreBP(ctx) {
      const kws = extractKeywords(`${ctx.bp.title} ${ctx.bp.description ?? ""}`, 8);
      return call(buildBpPrompt, ctx, kws);
    },
    async scoreWP(ctx) {
      const kws = [ctx.wp.name.toLowerCase(), ctx.wp.id];
      return call(buildWpPrompt, ctx, kws);
    },
    async scoreGP(ctx) {
      const kws = extractKeywords(`${ctx.gp.title} ${ctx.gp.description ?? ""} ${ctx.paSpec.scope ?? ""}`, 8);
      return call(buildGpPrompt, ctx, kws);
    },
  };
}

function fallback(reason, raw, references) {
  return {
    scorePercent: 0,
    evidence: [],
    gaps: [`LLM verdict rejected: ${reason}`],
    contextConsistency: { status: "unknown", note: "" },
    standardReferences: { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] },
    findings: [],
    ...(raw ? { rawLlmResponse: raw } : {}),
    ...(references ? { references } : {}),
  };
}
