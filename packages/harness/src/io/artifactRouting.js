/**
 * Artifact routing — map an uploaded artifact to the process it belongs to and
 * the kind of document it is, from its filename, plus display-name cleanup.
 *
 * Why this exists: in project mode every process is scored against the same
 * artifact batch. A broad, cross-cutting deliverable (e.g. the MAN.3 project
 * plan) keyword-matches *every* process and ends up cited as evidence in all of
 * them. Routing lets the per-process scoper keep, for each process, only the
 * artifacts that actually belong to it (its own deliverables) or are of a
 * document type appropriate to its area — so SUP processes are judged on their
 * plans/reports and engineering processes on their specs/designs/reports/
 * plans/results, instead of all inheriting MAN.3's plan.
 *
 * All detection is deterministic and filename-driven. Tokens are recognised in
 * both English (Plan, Report, Spec, Design, Result) and Korean (계획서, 보고서,
 * 명세서, 설계서, 결과서), since real project filenames mix the two
 * (e.g. "(문서번호)BSD_MAN3_Project_Plan", "BSD_SUP1_QA_계획서").
 */

// Process-area prefixes that can appear as a filename token (MAN3 → MAN.3).
// Kept in sync with the canonical process categories in spec/canonical.
const PROCESS_CATS = [
  "SYS", "SWE", "HWE", "MLE", "MAN", "SUP", "ACQ", "SPL", "REU", "VAL", "PIM",
];

// "_MAN3_", "-SUP.1-", " SWE 1 " → capture the category + number. A non-letter
// (or string start) must precede the category so "SYSTEM" is not read as SYS;
// the number must not be followed by another letter/digit (underscore is fine,
// since "MAN3_Plan" is a valid token but "MAN3V2"/"MANual" are not matches).
const OWNER_RE = new RegExp(
  `(?:^|[^A-Za-z])(${PROCESS_CATS.join("|")})[ ._-]?(\\d{1,2})(?![A-Za-z0-9])`,
  "i"
);

/**
 * Detect the process an artifact belongs to from its filename.
 * @returns {string|null} canonical process id like "MAN.3", or null if none.
 */
export function detectOwnerProcess(name) {
  if (!name) return null;
  const m = String(name).match(OWNER_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()}.${parseInt(m[2], 10)}`;
}

// Document-type patterns, checked in order so the more specific Korean/English
// terms win. "결과(서)" must be tested before "보고서" so "결과보고서" still reads
// as a report while a bare "결과서" reads as a result. "타당성/feasibility" is a
// distinct type tested *before* the generic "report" so a feasibility study
// (타당성 보고서) is never mistaken for an ordinary report — it is evidence for
// MAN.3 only and must not be inherited by every process.
const DOC_TYPE_RULES = [
  ["spec", /명세서|명세|specification|\bspecs?\b|requirements?[\s_-]*spec|\bsrs\b/i],
  ["design", /설계서|설계|architecture|architectural|\bdesign\b|\bsdd\b|\bsad\b/i],
  ["plan", /계획서|계획|\bplan\b/i],
  ["result", /결과서|결과(?!보고)|\bresults?\b/i],
  ["feasibility", /타당성|feasibility/i],
  ["report", /보고서|보고|\breport\b/i],
];

/**
 * Detect the document type from a filename.
 * @returns {"spec"|"design"|"plan"|"result"|"feasibility"|"report"|null}
 */
export function detectDocType(name) {
  if (!name) return null;
  // Underscores are word characters, so "Project_Plan" has no \b before "Plan".
  // Normalise separators to spaces so English \b…\b tokens match filename parts.
  const base = displayArtifactName(name).replace(/[_]+/g, " ");
  for (const [type, re] of DOC_TYPE_RULES) {
    if (re.test(base)) return type;
  }
  return null;
}

// Per-area document types that count as Finding evidence at CL1 (요청 사양):
//   SUP (지원영역)            → 계획서 + 활동보고서 + 심사결과서
//   MAN.3                     → 계획서 + 타당성 보고서
//   SYS/SWE/HWE/MLE 개발      → 요구사항 명세서 + 설계서 + 분석보고서
//   SYS/SWE/HWE/MLE 검증·테스트 → 검증·테스트 계획서 + 결과서
//   그 외(MAN.5/6, ACQ/…)     → 제한 없음 (null)
//
// "report" 버킷에는 분석보고서·활동보고서 등 일반 보고서만 들어오고, 타당성
// 보고서는 별도 "feasibility" 타입이라 MAN.3 외에는 절대 근거로 잡히지 않는다.
const SUP_TYPES = ["plan", "report", "result"];
const MAN3_TYPES = ["plan", "feasibility"];
const ENGINEERING_DEV_TYPES = ["spec", "design", "report"];
const ENGINEERING_TEST_TYPES = ["plan", "result"];
const ENGINEERING_CATS = new Set(["SYS", "SWE", "HWE", "MLE"]);

// A verification/test process inside an engineering category. The canonical
// PAM v4.0 names carry "Verification" or "Test(ing)" for exactly the test-side
// processes (SYS.4/5, SWE.4/5/6, HWE.3/4, MLE.4); the development processes
// (requirements / architecture / design / training) never do.
const VERIFICATION_NAME_RE = /verif|test/i;

/**
 * Whether a process is a verification/test process (vs a development one).
 * @param {{category?:string, name?:string}} processSpec
 */
export function isVerificationProcess(processSpec) {
  return (
    ENGINEERING_CATS.has(processSpec?.category) &&
    VERIFICATION_NAME_RE.test(processSpec?.name || "")
  );
}

/**
 * Allowed evidence document types for a *process* (not just its category): the
 * engineering area splits into development vs verification/test, and MAN.3 has
 * its own plan + feasibility scope, so the whole process spec is needed.
 * @param {{id?:string, category?:string, name?:string}} processSpec
 * @returns {string[]|null} null = no restriction.
 */
export function allowedDocTypesForProcess(processSpec) {
  if (!processSpec) return null;
  if (processSpec.category === "SUP") return SUP_TYPES;
  if (processSpec.id === "MAN.3") return MAN3_TYPES;
  if (ENGINEERING_CATS.has(processSpec.category)) {
    return isVerificationProcess(processSpec)
      ? ENGINEERING_TEST_TYPES
      : ENGINEERING_DEV_TYPES;
  }
  return null;
}

// Leading upload folder segments that are template scaffolding rather than the
// document itself — e.g. "2026년 템플릿/(문서번호)BSD_MAN3_Project_Plan.docx".
// Such segments are dropped from the *displayed* name (the full path is kept
// internally for page lookup / matching).
const TEMPLATE_FOLDER_RE = /템플릿/;

/**
 * Strip template/scaffolding folder segments from an artifact name for display.
 * Keeps any meaningful sub-path and the basename. Pure display helper — never
 * use the result as a lookup key against the original artifact list.
 */
export function displayArtifactName(name) {
  if (!name) return name;
  const segs = String(name).split(/[/\\]/).filter(Boolean);
  if (segs.length <= 1) return String(name);
  const kept = segs.filter((s) => !TEMPLATE_FOLDER_RE.test(s));
  return (kept.length ? kept : [segs[segs.length - 1]]).join("/");
}

/**
 * Scope a project's artifact batch to the subset relevant to one process.
 *
 * An artifact is eligible evidence for process P when it is not owned by a
 * *different* process and (when P's area restricts document types) is of an
 * allowed type, AND it carries a positive signal of belonging to P:
 *   - tagged with one of P's input/output WP ids, or
 *   - filename contains P's id ("SUP.1" / "sup1"), or
 *   - filename owner token resolves to P, or
 *   - it has no owner token but is of an allowed type for P's area.
 *
 * @param {{id:string, name?:string, category?:string, inputWorkProducts?:Array, outputWorkProducts?:Array}} processSpec
 * @param {Array<{name:string, wpidCandidates?:string[]}>} artifacts
 * @param {{strict?:boolean, docTypeScope?:boolean}} [opts] strict (project mode)
 *   never falls back to another process's deliverables when nothing matches;
 *   non-strict (single-process mode) preserves the legacy "score against
 *   everything" fallback for ad-hoc uploads. docTypeScope (default true) applies
 *   the per-area document-type restriction (요청 사양: CL1 근거 산출물 한정);
 *   callers pass docTypeScope:false above CL1, where every document type is
 *   admissible and only owner-based routing applies.
 * @returns {Array} the scoped artifact subset.
 */
export function scopeArtifactsForProcess(processSpec, artifacts, opts = {}) {
  const strict = !!opts.strict;
  const docTypeScope = opts.docTypeScope !== false;
  const pid = processSpec.id;
  const idLow = (pid || "").toLowerCase();
  const idCompact = idLow.replace(/\./g, "");
  const expectedWp = new Set([
    ...((processSpec.inputWorkProducts ?? []).map((w) => w.id)),
    ...((processSpec.outputWorkProducts ?? []).map((w) => w.id)),
  ]);
  const allowed = docTypeScope ? allowedDocTypesForProcess(processSpec) : null;

  const eligible = (artifacts ?? []).filter((a) => {
    const owner = detectOwnerProcess(a.name);
    // Belongs to a *different* process → never evidence for this one.
    if (owner && owner !== pid) return false;
    // Doc-type gate: when the area restricts types, a typed artifact must match.
    const type = detectDocType(a.name);
    if (allowed && type && !allowed.includes(type)) return false;
    // Positive ownership signals.
    if ((a.wpidCandidates ?? []).some((id) => expectedWp.has(id))) return true;
    const nameLow = (a.name || "").toLowerCase();
    if (nameLow.includes(idLow) || (idCompact && nameLow.includes(idCompact))) return true;
    if (owner === pid) return true;
    // Ownerless artifact of an allowed type — plausibly this area's evidence.
    if (!owner && allowed && type && allowed.includes(type)) return true;
    return false;
  });

  if (eligible.length) return eligible;
  // No artifact belongs to this process. In strict (project) mode never pull in
  // another process's deliverable — only ownerless files may serve as a last
  // resort, and even then they must respect this area's doc-type gate so e.g.
  // an ownerless 타당성 보고서 (feasibility) is not back-filled into every
  // process that lacks its own deliverable. Feasibility is MAN.3-exclusive, so
  // it is dropped unless this process explicitly allows it. In non-strict
  // (single-process) mode keep the legacy full fallback for ad-hoc uploads.
  if (strict) {
    return (artifacts ?? []).filter((a) => {
      if (detectOwnerProcess(a.name)) return false;
      if (!docTypeScope) return true; // above CL1: no doc-type restriction
      const type = detectDocType(a.name);
      if (type === "feasibility" && !(allowed && allowed.includes("feasibility"))) return false;
      if (allowed && type && !allowed.includes(type)) return false;
      return true;
    });
  }
  return artifacts ?? [];
}
