import { percentToRating } from "../model/rating.js";
import { lookupStandardRefs } from "../../spec/standardRefs.js";
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
  const results = [];
  for (const bp of processSpec.basePractices) {
    const {
      scorePercent,
      evidence,
      gaps,
      contextConsistency,
      standardReferences,
      findings,
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
    const mergedRefs = unionStandardReferences(
      standardReferences ?? { pam: [], pamNote: [], bgbRL: [], iso: [] },
      { pam: [], pamNote: [], bgbRL: csvRefs.bgbRL, iso: [] }
    );
    mergedRefs.iso = [];
    const enrichedFindings = (Array.isArray(findings) ? findings : []).map((f) => {
      const refs = unionStandardReferences(f.standardReferences, {
        pam: [],
        pamNote: [],
        bgbRL: csvRefs.bgbRL,
        iso: [],
      });
      refs.iso = [];
      return { ...f, standardReferences: refs };
    });
    results.push({
      id: bp.id,
      title: bp.title,
      rating: percentToRating(scorePercent),
      scorePercent,
      evidence,
      gaps,
      pamCitation: bp.pamCitation ?? processSpec.pamSection,
      contextConsistency: contextConsistency ?? { status: "unknown", note: "" },
      standardReferences: mergedRefs,
      findings: enrichedFindings,
    });
  }
  return results;
}
