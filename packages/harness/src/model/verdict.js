/**
 * @typedef {import("./rating.js").Rating} Rating
 * @typedef {import("./rating.js").CollapsedRating} CollapsedRating
 * @typedef {import("./finding.js").Finding} Finding
 *
 * @typedef {Object} Evidence
 * @property {string} artifactName
 * @property {string} quote
 * @property {string} [location]
 *
 * @typedef {Object} BPResult
 * @property {string} id            e.g. "BP1"
 * @property {string} title
 * @property {Rating} rating
 * @property {number} scorePercent
 * @property {Evidence[]} evidence
 * @property {string[]} gaps
 * @property {string} pamCitation   PAM section ref
 * @property {Finding[]} [findings]  결론 진술형 Finding 목록 (P1 신규, 옵션)
 * @property {KnowledgeReferences} [references]  PAM 4.1 / Guideline 2026 sources
 * @property {AppliedRule[]} appliedRules  guideline rules applied (scorer or rule-engine)
 *
 * @typedef {Object} GPResult
 * @property {string} id            e.g. "GP 2.1.1"
 * @property {string} title
 * @property {Rating} rating
 * @property {number} scorePercent
 * @property {Evidence[]} evidence
 * @property {string[]} gaps
 * @property {Finding[]} [findings]  결론 진술형 Finding 목록 (P2 신규, 옵션)
 * @property {string} [pamCitation]
 * @property {KnowledgeReferences} [references]
 * @property {AppliedRule[]} appliedRules
 *
 * @typedef {Object} WPResult
 * @property {string} wpId
 * @property {string} name
 * @property {Rating} rating
 * @property {number} scorePercent
 * @property {Evidence[]} evidence
 * @property {string[]} gaps
 * @property {string} [pamCitation]
 * @property {KnowledgeReferences} [references]
 * @property {AppliedRule[]} appliedRules
 *
 * @typedef {Object} AppliedRule
 * @property {string} ruleId
 * @property {boolean} applied
 * @property {string} note
 * @property {string} [source]     "rule-engine" when applied by the post-processor
 * @property {boolean} [capped]    true when the score was lowered
 *
 * @typedef {Object} KnowledgeReferences
 * @property {{citation: string, page?: number, title?: string}} pam
 * @property {Array<{id: string, effect: string, section?: string, page?: number, summary: string, conditional?: string, displayOnly?: boolean}>} guideline
 *
 * @typedef {Object} PAResult
 * @property {string} paId          e.g. "PA 1.1"
 * @property {number} level         1|2|3
 * @property {Rating} rating        6-point display
 * @property {CollapsedRating} collapsed  for CL aggregation
 * @property {GPResult[]} gps
 *
 * @typedef {Object} ProcessVerdict
 * @property {string} processId
 * @property {string} processName
 * @property {BPResult[]} bps
 * @property {PAResult[]} pas
 * @property {CollapsedRating} capabilityLevelAchieved  "N"=CL0, "F" at PA1.1 → CL1, etc
 * @property {0|1|2|3} capabilityLevel
 * @property {Object} meta
 */

export {};
