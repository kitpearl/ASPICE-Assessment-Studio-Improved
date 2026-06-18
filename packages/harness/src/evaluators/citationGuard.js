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
 *   - BGB Rating Rule (P5-bis 발견 후 의미 정정 — 단순 등급이 아닌 조건부
 *     평가 규칙의 식별자): "[SYS.2.RL.2]", "[GEN.RL.1]", "[PA2.1.RL.5]".
 *     호환을 위해 단순 등급 표기 ("RL3", "RL3.2") 도 계속 인정한다.
 *   - ISO / 자동차 산업 표준 clause (P5-ter 확장 — 슬롯 이름은 "iso" 그대로
 *     유지하되 ISO 외에 IEC, IATF, ISO/SAE 등 자동차 평가 맥락에서 흔히 인용
 *     되는 표준을 함께 수용한다):
 *       "ISO 26262-6:2018 §8.4.5"        ← § 표기
 *       "ISO 26262-6 clause 8.4.5"       ← PAM v4.0 본문 표기 (clause 단어)
 *       "ISO/IEC 33020:2019 §5.3"
 *       "ISO/SAE 21434"
 *       "IEC 61508 clause 7.2"
 *       "IATF 16949:2016 clause 8.4.1.2"
 */

import { makeFinding, validateFinding } from "../model/finding.js";

const CITATION_RE = /PAM\s*§\s*(?:\d+(?:\.\d+){0,3}|[A-Z]{2,4}\.\d+)(?:\s+(?:BP\d+|GP\s?\d\.\d\.\d))?/;
const PAM_NOTE_RE = /^PAM\s+Note\s+[A-Z]{2,4}\.\d+-\d+$/;
// BGB 표기 두 가지를 수용:
//   1. 단순 등급: RL3 / RL3.2 (legacy compat)
//   2. 규칙 ID: [PROC.SUBPROC.RL.N] / [GEN.RL.N] / [PA2.1.RL.5] 등
//      (실제 BGB Guideline 본문에서 사용하는 표기)
const BGB_RL_RE = /^(?:RL\d+(?:\.\d+)?|\[[A-Z][A-Z0-9.]*\.RL\.(?:\d+|xx)\])$/;
// ISO/IATF/IEC clause: standard prefix (ISO[ /IEC | /SAE ] | IEC | IATF) 다음에
// 표준 번호(예: 26262, 16949), 선택적 part(-6), 선택적 연도(:2018), 선택적
// clause 표기 (§8.4.5 또는 clause 8.4.5) 를 허용.
const ISO_CLAUSE_RE =
  /^(?:ISO(?:\/(?:IEC|SAE))?|IEC|IATF)\s+\d+(?:-\d+)?(?::\d{4})?(?:\s+(?:§[\d.]+|clause\s+[\d.]+))?$/;
// INCOSE GtWR (Guide to Writing Requirements) V4 인용:
//   특성  : "INCOSE GtWR C7"  (C1–C15)
//   작성 룰: "INCOSE GtWR R18" (R1–R42)
//   속성  : "INCOSE GtWR A6"  (A1–A49)
// "GtWR" 는 선택(LLM 이 생략해도 수용)하고, 식별자 뒤에 짧은 이름이 따라와도
// 무방하다 (예: "INCOSE GtWR C7 Verifiable").
const INCOSE_REF_RE = /^INCOSE(?:\s+GtWR)?\s+(?:C|R|A)\d{1,2}(?:\s+\S.*)?$/;

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

/** @param {string|undefined} ref */
export function hasIncoseRef(ref) {
  return typeof ref === "string" && INCOSE_REF_RE.test(ref.trim());
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
  const refs = { pam: [], pamNote: [], bgbRL: [], iso: [], incose: [] };
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
  filterPush(refs.incose, "incose", hasIncoseRef, raw.incose);
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
 * LLM 응답의 findings 배열을 정규화한다. 각 raw finding 은 makeFinding 으로
 * 빈 슬롯을 채운 뒤 validateFinding 으로 검증한다. 무효 항목은 silently drop
 * 하고 droppedFindings 에 이유를 노출한다 (전체 응답을 거부하면 scoring 데이터
 * 까지 잃으므로 부분 수용이 안전).
 *
 * 또한 finding 내부의 standardReferences 슬롯도 normalizeStandardReferences
 * 로 재처리해 표기 규칙을 일관 적용한다.
 *
 * @param {any} rawFindings
 * @returns {{findings: import("../model/finding.js").Finding[], dropped: string[]}}
 */
export function normalizeFindings(rawFindings) {
  const findings = [];
  const dropped = [];
  if (!Array.isArray(rawFindings)) return { findings, dropped };
  for (let i = 0; i < rawFindings.length; i++) {
    const raw = rawFindings[i];
    if (!raw || typeof raw !== "object") {
      dropped.push(`[${i}]:<non-object>`);
      continue;
    }
    const { refs: normalizedRefs } = normalizeStandardReferences(raw.standardReferences);
    const candidate = makeFinding({ ...raw, standardReferences: normalizedRefs });
    const v = validateFinding(candidate);
    if (v.ok) findings.push(candidate);
    else dropped.push(`[${i}]:${v.reason}`);
  }
  return { findings, dropped };
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
  const { findings, dropped: droppedFindings } = normalizeFindings(raw.findings);
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
      findings,
      droppedFindings,
    },
  };
}
