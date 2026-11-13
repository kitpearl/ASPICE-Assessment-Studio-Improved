import { percentToRating } from "../model/rating.js";
import { lookupStandardRefs } from "../../spec/standardRefs.js";
import { isIncoseApplicable, lookupIncoseRefs } from "../../spec/incose/index.js";
import { unionStandardReferences } from "./findingBuilders.js";

/**
 * Evaluate every Base Practice of a process against the supplied artifacts.
 * Returns an array of BPResult. Concrete scoring delegates to the configured
 * scoring strategy (rule | llm | hybrid) — this module is the orchestrator,
 * not the scorer.
 *
 * @param {import("./types.js").ProcessSpec} processSpec
 * @param {import("../model/evidence.js").Artifact[]} artifacts
 * @param {import("./scorer.js").Scorer} scorer
 * @param {{
 *   projectFingerprint?: import("../io/projectContext.js").ProjectFingerprint,
 *   mode?: "process" | "project"
 * }} [options]
 * @returns {Promise<import("../model/verdict.js").BPResult[]>}
 */
export async function evaluateBPs(processSpec, artifacts, scorer, options = {}) {
  const { projectFingerprint, mode } = options;
  // BPs are scored in parallel; `map` preserves spec order in the result array.
  // Real API concurrency is bounded centrally by the LLM client wrapper (see
  // _harnessService.limitConcurrency), so fanning out here does not risk rate
  // limits. The rule/custom scorers are effectively synchronous, so this is a
  // no-op cost for them.
  return Promise.all(
    processSpec.basePractices.map(async (bp) => {
    const {
      scorePercent,
      evidence,
      gaps,
      contextConsistency,
      standardReferences,
      findings,
      references,
      appliedRules,
    } = await scorer.scoreBP({
      process: processSpec,
      bp,
      artifacts,
      projectFingerprint,
      // Forwarded to the LLM scorer → buildBpPrompt. Accepted for call-site
      // stability only: BP scoring is mode-independent so process and project
      // runs grade the same artifact identically (see buildBpPrompt).
      mode,
    });
    const bpFullId = `${processSpec.id}.${bp.id}`;
    // P5: 사용자가 spec/bgb/*.csv 에 채워둔 BGB Rating Level 매핑을 BPResult 와
    // 각 finding 에 union 으로 병합한다.
    //
    // ISO 근거(ISO 26262 / ISO/IEC ...)는 BP 평가 근거에서 제외한다 (요청):
    // BP-level 평가는 PAM 과 BGB(Rating Level) 만을 근거로 삼는다. 따라서
    // spec/iso/*.csv 의 매핑은 더 이상 병합하지 않고, scorer (예: LLM 모드)가
    // 출력한 iso 인용도 여기서 제거하여 어떤 모드에서도 ISO 가 노출되지 않게 한다.
    const csvRefs = lookupStandardRefs(bpFullId);
    // INCOSE GtWR V4 렌즈: 요구사항 분석 프로세스(SYS.2/SWE.1/HWE.1)의 BP 에만
    // 적용된다. BP-level 에는 "이 BP 가 평가된 INCOSE 특성" 목록을 부착하고,
    // 각 Finding 은 LLM 이 구체 위반으로 인용한 INCOSE 참조만 유지한다.
    const incoseApplicable = isIncoseApplicable(processSpec.id);
    const incoseRefs = incoseApplicable ? lookupIncoseRefs(bpFullId) : [];
    const mergedRefs = unionStandardReferences(
      standardReferences ?? { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] },
      { pam: [], pamNote: [], bgbRL: csvRefs.bgbRL, iso: [], incose: incoseRefs }
    );
    mergedRefs.iso = [];
    if (!incoseApplicable) mergedRefs.incose = [];
    const enrichedFindings = (Array.isArray(findings) ? findings : []).map((f) => {
      const refs = unionStandardReferences(f.standardReferences, {
        pam: [],
        pamNote: [],
        bgbRL: csvRefs.bgbRL,
        iso: [],
        incose: [],
      });
      refs.iso = [];
      if (!incoseApplicable) refs.incose = [];
      return { ...f, standardReferences: refs };
    });
    return {
      id: bp.id,
      title: bp.title,
      rating: percentToRating(scorePercent),
      scorePercent,
      evidence,
      gaps,
      pamCitation: references?.pam?.citation ?? bp.pamCitation ?? processSpec.pamSection,
      contextConsistency: contextConsistency ?? { status: "unknown", note: "" },
      standardReferences: mergedRefs,
      findings: enrichedFindings,
      appliedRules: appliedRules ?? [],
      ...(references !== undefined ? { references } : {}),
    };
    })
  );
}
