import { percentToRating } from "../model/rating.js";

/**
 * Evaluate Output Work Product presence + quality for a process.
 * Used by PA 2.2 (Work Product Management) but also informs BP confidence.
 *
 * @param {import("./types.js").ProcessSpec} processSpec
 * @param {import("../model/evidence.js").Artifact[]} artifacts
 * @param {import("./scorer.js").Scorer} scorer
 * @param {{projectFingerprint?: import("../io/projectContext.js").ProjectFingerprint}} [options]
 */
export async function evaluateWPs(processSpec, artifacts, scorer, options = {}) {
  const { projectFingerprint } = options;
  // Scored in parallel; `map` preserves spec order. Global API concurrency is
  // bounded by the LLM client wrapper (see _harnessService.limitConcurrency).
  return Promise.all(
    processSpec.outputWorkProducts.map(async (wp) => {
      const { scorePercent, evidence, gaps, contextConsistency } = await scorer.scoreWP({
        process: processSpec,
        wp,
        artifacts,
        projectFingerprint,
      });
      return {
        wpId: wp.id,
        name: wp.name,
        rating: percentToRating(scorePercent),
        scorePercent,
        evidence,
        gaps,
        contextConsistency: contextConsistency ?? { status: "unknown", note: "" },
      };
    })
  );
}
