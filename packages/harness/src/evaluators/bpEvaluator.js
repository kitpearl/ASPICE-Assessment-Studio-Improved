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
 * @param {{projectFingerprint?: import("../io/projectContext.js").ProjectFingerprint}} [options]
 * @returns {Promise<import("../model/verdict.js").BPResult[]>}
 */
export async function evaluateBPs(processSpec, artifacts, scorer, options = {}) {
  const { projectFingerprint } = options;
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
    });
    const bpFullId = `${processSpec.id}.${bp.id}`;
    // P5: 사용자가 spec/{bgb,iso}/*.csv 에 채워둔 매핑을 BPResult 와 각
    // finding 에 union 으로 병합한다. scorer (rule/llm/hybrid) 가 이미 채운
    // refs (예: LLM 이 출력한 ISO 인용) 와 spec-derived refs 가 함께 노출되어
    // 시니어 평가자가 양쪽 출처를 모두 확인할 수 있도록 한다.
    const csvRefs = lookupStandardRefs(bpFullId);
    const mergedRefs = unionStandardReferences(
      standardReferences ?? { pam: [], pamNote: [], bgbRL: [], iso: [] },
      { pam: [], pamNote: [], bgbRL: csvRefs.bgbRL, iso: csvRefs.iso }
    );
    const enrichedFindings = (Array.isArray(findings) ? findings : []).map((f) => ({
      ...f,
      standardReferences: unionStandardReferences(
        f.standardReferences,
        { pam: [], pamNote: [], bgbRL: csvRefs.bgbRL, iso: csvRefs.iso }
      ),
    }));
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
