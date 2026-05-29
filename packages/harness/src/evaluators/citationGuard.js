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
 *   PAM §5 GP 1.1.1        ← top-level GP section, no subsection dots
 *   PAM §SWE.2 BP1         ← process-prefixed form (canonical spec form)
 *   PAM §SUP.10
 *
 * Beyond the PAM section citation, individual Finding 객체는
 * standardReferences 슬롯에 다음 표기를 추가로 실을 수 있다 (P1):
 *   - PAM Note: "PAM Note SWE.2-1"
 *   - BGB Rating Level: "RL3", "RL3.2"
 *   - ISO clause: "ISO 26262-6:2018 §8.4.5", "ISO/IEC 33020:2019 §5.3"
 */

const CITATION_RE = /PAM\s*§\s*(?:\d+(?:\.\d+){0,3}|[A-Z]{2,4}\.\d+)(?:\s+(?:BP\d+|GP\s?\d\.\d\.\d))?/;
const PAM_NOTE_RE = /^PAM\s+Note\s+[A-Z]{2,4}\.\d+-\d+$/;
const BGB_RL_RE = /^RL\d+(?:\.\d+)?$/;
const ISO_CLAUSE_RE = /^ISO(?:\/IEC)?\s+\d+(?:-\d+)?(?::\d{4})?(?:\s+§[\d.]+)?$/;

/** @param {string|undefined} citation */
export function hasPamCitation(citation) {
  return typeof citation === "string" && CITATION_RE.test(citation);
}

/** @param {string|undefined} ref */
export function hasPamNote(ref) {
  return typeof ref === "string" && PAM_NOTE_RE.test(ref.trim());
}

/** @param {string|undefined} ref */
export function hasBgbRL(ref) {
  return typeof ref === "string" && BGB_RL_RE.test(ref.trim());
}

/** @param {string|undefined} ref */
export function hasIsoClause(ref) {
  return typeof ref === "string" && ISO_CLAUSE_RE.test(ref.trim());
}

/**
 * 임의의 raw 값을 깨끗한 StandardReferences 로 정규화. 형식에 맞지 않는
 * 항목은 silently drop (UI 가 잘못된 표기를 보여주는 것보다 누락이 안전).
 * 어떤 항목이 drop 되었는지는 dropped 배열로 노출해 호출자가 로깅할 수 있게 한다.
 *
 * @param {any} raw
 * @returns {{refs: import("../model/finding.js").StandardReferences, dropped: string[]}}
 */
export function normalizeStandardReferences(raw) {
  const refs = { pam: [], pamNote: [], bgbRL: [], iso: [] };
  const dropped = [];
  if (!raw || typeof raw !== "object") return { refs, dropped };
  const filterPush = (arr, key, validator, source) => {
    if (!Array.isArray(source)) return;
    for (const v of source) {
      if (typeof v !== "string") {
        dropped.push(`${key}:<non-string>`);
        continue;
      }
      const t = v.trim();
      if (validator(t)) arr.push(t);
      else dropped.push(`${key}:${t}`);
    }
  };
  filterPush(refs.pam, "pam", hasPamCitation, raw.pam);
  filterPush(refs.pamNote, "pamNote", hasPamNote, raw.pamNote);
  filterPush(refs.bgbRL, "bgbRL", hasBgbRL, raw.bgbRL);
  filterPush(refs.iso, "iso", hasIsoClause, raw.iso);
  return { refs, dropped };
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
export function validateLlmResult(raw) {
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
  const { refs: standardReferences, dropped: droppedRefs } = normalizeStandardReferences(raw.standardReferences);
  return {
    ok: true,
    result: {
      scorePercent: Math.round(raw.scorePercent),
      evidence,
      gaps,
      pamCitation: raw.pamCitation,
      contextConsistency,
      standardReferences,
      droppedRefs,
    },
  };
}
