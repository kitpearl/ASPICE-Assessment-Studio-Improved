import {
  SYSTEM_PREFIX,
  LANGUAGE_AND_QUOTE_RULES,
  GUIDELINE_CITATION_INSTRUCTION,
  guidelineBlocks,
  jsonSchemaLines,
} from "./common.js";

/**
 * Build the assessor prompt for one Base Practice.
 *
 * Returns a three-part structure that the LLM client adapters can translate
 * into cached + dynamic message blocks (Anthropic) or a concatenated user
 * message (OpenAI):
 *   - system  : assessor persona (stable, cacheable across all calls)
 *   - context : process spec + PAM 4.1 / Guideline 2026 knowledge + evidence excerpt
 *   - task    : BP-specific question (varies per call)
 *
 * Project-context check: the assessor must additionally judge whether each
 * cited piece of evidence preserves the *product / project context* of the
 * batch (i.e. is from the same program/system as the rest of the deliverables).
 * Off-context evidence cannot earn full credit even if it structurally matches
 * the BP description.
 *
 * `knowledge` (BpKnowledge from src/knowledge) is optional; when null the
 * context and task are built exactly as before the knowledge layer existed.
 */
export function buildBpPrompt({
  process,
  bp,
  artifactsExcerpt,
  projectFingerprint,
  knowledge = null,
}) {
  const system = `${SYSTEM_PREFIX} You evaluate evidence against Base Practices and Process Attributes defined in the PAM. You MUST cite the relevant PAM section for every verdict (format: "PAM 4.1 §X.Y.Z" with optional " <PROCESS>.BP#" or " GP X.Y.Z"). You also verify that submitted evidence is from the SAME product/project context as the rest of the deliverables — evidence that is structurally relevant but clearly references a different program, product, system, or release MUST be down-rated and flagged. You return JSON ONLY. ${LANGUAGE_AND_QUOTE_RULES}`;

  const knowledgeLines = knowledge ? bpKnowledgeBlocks(knowledge) : [];

  const context = [
    `Process: ${process.id} ${process.name}`,
    `PAM section: ${process.pamSection}`,
    `Process purpose: ${process.purpose}`,
    "",
    ...knowledgeLines,
    `Project / product context fingerprint (dominant terms across the uploaded batch):`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `Evidence excerpts (from uploaded work products):`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const citation = knowledge?.references?.pam?.citation;
  const task = [
    `Evaluate this Base Practice:`,
    `  ${process.id}.${bp.id}: ${bp.title}`,
    bp.description ? `  ${bp.description}` : "",
    "",
    citation
      ? `Score 0-100 for extent of achievement. Cite exactly "${citation}" as pamCitation.`
      : `Score 0-100 for extent of achievement. Cite PAM §${process.pamSection} ${bp.id} (or narrower).`,
    `Then judge whether the evidence preserves the project / product context:`,
    `  - "consistent"  : evidence clearly belongs to the same project/product as the fingerprint`,
    `  - "partial"     : evidence is mixed; some artifacts look off-project`,
    `  - "off-context" : evidence references a different project/product/release than the fingerprint`,
    `  - "unknown"     : not enough signal to decide`,
    `If status is "partial" or "off-context" you MUST reduce scorePercent accordingly and explain in "contextConsistency.note".`,
    ...(knowledge ? [`guidelineCitations: ${GUIDELINE_CITATION_INSTRUCTION}`] : []),
    ...jsonSchemaLines({ withLocation: true, withGuideline: Boolean(knowledge) }),
  ].join("\n");

  return { system, context, task };
}

function bpKnowledgeBlocks(k) {
  const p = k.process ?? {};
  const b = k.bp ?? {};
  const outcomes = (p.outcomes ?? []).map((o) => `  ${o.id}. ${o.text}`);
  const notes = (b.notes ?? []).map((n) => `  ${n}`);
  const wps = (k.outputWorkProducts ?? []).map((w) => `- ${w.id} ${w.name}`);
  return [
    "## PAM 4.1 — 프로세스",
    `${p.id} ${p.name ?? ""}`.trim(),
    `목적: ${p.purpose ?? ""}`,
    "성과:",
    ...(outcomes.length ? outcomes : ["  (없음)"]),
    "",
    "## PAM 4.1 — 평가 대상 BP",
    `${p.id}.${b.id}: ${b.title ?? ""}${b.titleEn ? ` (${b.titleEn})` : ""}`,
    b.description ? `설명: ${b.description}` : "",
    ...(notes.length ? ["비고:", ...notes] : []),
    "",
    "## 출력 정보 항목",
    ...(wps.length ? wps : ["(없음)"]),
    "",
    ...guidelineBlocks(k.guideline),
  ];
}
