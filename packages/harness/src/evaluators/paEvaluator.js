import { percentToRating, collapse } from "../model/rating.js";

/**
 * Evaluate Process Attributes (PA 1.1 ~ PA 3.2) for a process using its
 * generic practices. PA 1.1 is anchored on BP results; PA 2.1/2.2/3.1/3.2
 * are evaluated via GP-specific prompts against the artifacts.
 *
 * @param {import("./types.js").ProcessSpec} processSpec
 * @param {Record<string, import("./types.js").PASpec>} paSpecs  from processAttributes.json
 * @param {import("../model/verdict.js").BPResult[]} bpResults
 * @param {import("../model/verdict.js").WPResult[]} [wpResults]
 * @param {import("../model/evidence.js").Artifact[]} artifacts
 * @param {import("./scorer.js").Scorer} scorer
 * @param {{level: 1|2|3, projectFingerprint?: import("../io/projectContext.js").ProjectFingerprint}} opts
 *   `level` selects which capability level range to evaluate up to;
 *   `projectFingerprint` is the precomputed batch fingerprint passed to the
 *   scorer so per-GP context-consistency checks have the same baseline.
 * @returns {Promise<import("../model/verdict.js").PAResult[]>}
 */
export async function evaluatePAs(
  processSpec,
  paSpecs,
  bpResults,
  wpResults,
  artifacts,
  scorer,
  opts
) {
  const maxLevel = opts?.level ?? 1;
  const projectFingerprint = opts?.projectFingerprint;
  const out = [];
  for (const [paId, paSpec] of Object.entries(paSpecs)) {
    if (paSpec.level > maxLevel) continue;

    // GPs scored in parallel; `map` preserves spec order. Global API
    // concurrency is bounded by the LLM client wrapper (see
    // _harnessService.limitConcurrency).
    const gps = await Promise.all(
      paSpec.genericPractices.map(async (gp) => {
        const {
          scorePercent,
          evidence,
          gaps,
          contextConsistency,
          standardReferences,
          findings,
          references,
          appliedRules,
        } = await scorer.scoreGP({
          process: processSpec,
          paSpec,
          gp,
          bpResults,
          wpResults,
          artifacts,
          projectFingerprint,
        });
        return {
          id: gp.id,
          title: gp.title,
          rating: percentToRating(scorePercent),
          scorePercent,
          evidence,
          gaps,
          contextConsistency: contextConsistency ?? { status: "unknown", note: "" },
          standardReferences: standardReferences ?? { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] },
          findings: Array.isArray(findings) ? findings : [],
          appliedRules: appliedRules ?? [],
          ...(pamCitationOf(references, gp) ? { pamCitation: pamCitationOf(references, gp) } : {}),
          ...(references !== undefined ? { references } : {}),
        };
      })
    );

    const avg =
      gps.length === 0 ? 0 : gps.reduce((s, g) => s + g.scorePercent, 0) / gps.length;
    const rating = percentToRating(avg);
    out.push({
      paId,
      level: paSpec.level,
      rating,
      // The score that actually drove `rating`. For PA 1.1 under hybrid/llm
      // this is the GP 1.1.1 blend, NOT the raw BP average — reports must show
      // this number next to the pill so the two never contradict.
      scorePercent: Math.round(avg),
      collapsed: collapse(rating),
      gps,
    });
  }
  return out;
}

function pamCitationOf(references, gp) {
  return references?.pam?.citation ?? gp.pamCitation;
}
