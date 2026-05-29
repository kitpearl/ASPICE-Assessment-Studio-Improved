/**
 * Scorer contract. Concrete implementations:
 *   - RuleScorer    : keyword / WPID presence heuristics (offline, fast)
 *   - LlmScorer     : one-shot LLM call with PAM citation enforced
 *   - HybridScorer  : weighted fusion of the above
 *
 * All scorer methods return a uniform shape so the evaluators remain agnostic.
 *
 * @typedef {Object} ScoreResult
 * @property {number} scorePercent   0..100
 * @property {import("../model/verdict.js").Evidence[]} evidence
 * @property {string[]} gaps
 * @property {string} [pamCitation]                       LLM/Hybrid 만 채움
 * @property {{status: string, note: string}} [contextConsistency]
 * @property {import("../model/finding.js").StandardReferences} [standardReferences]
 * @property {import("../model/finding.js").Finding[]} [findings]   결론 진술형 Finding 목록 (P2)
 *
 * @typedef {Object} Scorer
 * @property {(ctx: {process, bp, artifacts}) => Promise<ScoreResult>} scoreBP
 * @property {(ctx: {process, wp, artifacts}) => Promise<ScoreResult>} scoreWP
 * @property {(ctx: {process, paSpec, gp, bpResults, wpResults, artifacts}) => Promise<ScoreResult>} scoreGP
 */

export {};
