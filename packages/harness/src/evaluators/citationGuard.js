/**
 * Enforce PAM citation on any LLM verdict. Every scoreBP/scoreGP response
 * must reference an authoritative PAM section so the final report can tie
 * judgments back to the standard. Responses that lack a valid citation are
 * considered invalid — in hybrid mode the rule score is used as fallback;
 * in llm-only mode the BP is rated N with the reason recorded in `gaps`.
 *
 * Valid citation shapes accepted:
 *   PAM §4.3.2
 *   PAM §4.3.2 BP5
 *   PAM §5.3.1 GP 2.1.1
 *   PAM §3.2.2
 *   PAM §5 GP 1.1.1     ← top-level GP section, no subsection dots
 *   PAM §4.4.1 SWE.1.BP2 ← process-qualified BP
 * PAM 4.1 forms (version prefix, same section shapes):
 *   PAM 4.1 §4.3.2 BP5
 *   PAM 4.1 §5.3.1 GP 2.1.1
 * Annex B work-product forms:
 *   PAM Annex B 17-00
 *   PAM 4.1 Annex B 17-00
 */

import { normalizeGuidelineCitations } from "./guidelineEffects.js";

// Section form: "PAM [4.1] §x.y.z [SWE.1.BP2 | BP2 | GP 2.1.1]"; Annex form: "PAM [4.1] Annex B 17-00".
const CITATION_RE =
  /PAM(?:\s*4\.1)?\s*§\s*\d+(?:\.\d+){0,3}(?:\s+(?:(?:[A-Z]{3}\.\d+\.)?BP\d+|GP\s?\d\.\d\.\d))?|PAM(?:\s*4\.1)?\s+Annex\s+B\s+\d{2}-\d{2}/;

/** @param {string|undefined} citation */
export function hasPamCitation(citation) {
  return typeof citation === "string" && CITATION_RE.test(citation);
}

/**
 * Accepted contextConsistency.status values. Anything else (including a
 * missing object) normalises to "unknown" so the response is not rejected —
 * a malformed context verdict should degrade gracefully, not invalidate an
 * otherwise well-formed scoring decision.
 */
const CONTEXT_STATUSES = new Set(["consistent", "partial", "off-context", "unknown"]);

export function normalizeContextConsistency(raw) {
  if (!raw || typeof raw !== "object") {
    return { status: "unknown", note: "" };
  }
  const status = CONTEXT_STATUSES.has(raw.status) ? raw.status : "unknown";
  const note = typeof raw.note === "string" ? raw.note : "";
  return { status, note };
}

/**
 * @param {any} raw  LLM JSON response
 * @returns {{ok: true, result: any} | {ok: false, reason: string}}
 */
export function validateLlmResult(raw, opts = {}) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "response is not an object" };
  }
  if (typeof raw.scorePercent !== "number" || raw.scorePercent < 0 || raw.scorePercent > 100) {
    return { ok: false, reason: `scorePercent out of range: ${raw.scorePercent}` };
  }
  if (!hasPamCitation(raw.pamCitation)) {
    return { ok: false, reason: `missing or invalid PAM citation: ${JSON.stringify(raw.pamCitation)}` };
  }
  const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
  const gaps = Array.isArray(raw.gaps) ? raw.gaps : [];
  const contextConsistency = normalizeContextConsistency(raw.contextConsistency);
  return {
    ok: true,
    result: {
      scorePercent: Math.round(raw.scorePercent),
      evidence,
      gaps,
      pamCitation: raw.pamCitation,
      contextConsistency,
      appliedRules: normalizeGuidelineCitations(raw.guidelineCitations, opts.knownRuleIds ?? new Set()),
    },
  };
}
