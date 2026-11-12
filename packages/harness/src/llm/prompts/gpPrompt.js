import {
  SYSTEM_PREFIX,
  LANGUAGE_AND_QUOTE_RULES,
  GUIDELINE_CITATION_INSTRUCTION,
  guidelineBlocks,
  jsonSchemaLines,
} from "./common.js";

/**
 * Build the assessor prompt for one Generic Practice (PA 1.1 ~ 3.2).
 *
 * Project-context check applies here too: GP evidence drawn from off-project
 * artifacts (e.g. another program's planning template) does not demonstrate
 * the GP for *this* project.
 *
 * `knowledge` (GpKnowledge) is optional; null keeps the pre-knowledge context.
 */
export function buildGpPrompt({
  process,
  paSpec,
  gp,
  bpResults,
  wpResults,
  artifactsExcerpt,
  projectFingerprint,
  knowledge = null,
}) {
  const system = `${SYSTEM_PREFIX} You evaluate Process Attributes by judging their Generic Practices against evidence, AND verify that the evidence belongs to the same product/project context as the rest of the deliverables. Cite PAM 4.1 §X.Y.Z for the rule you apply. Return JSON ONLY. ${LANGUAGE_AND_QUOTE_RULES}`;

  const bpSummary = (bpResults ?? [])
    .map((r) => `  ${r.id}: ${r.rating} (${r.scorePercent}%)`)
    .join("\n") || "  (none)";
  const wpSummary = (wpResults ?? [])
    .map((r) => `  ${r.wpId} ${r.name}: ${r.rating}`)
    .join("\n") || "  (none)";

  const knowledgeLines = knowledge ? gpKnowledgeBlocks(knowledge) : [];

  const context = [
    `Process: ${process.id} ${process.name}`,
    `Process Attribute: ${paSpec.id} ${paSpec.name} (capability level ${paSpec.level})`,
    `PA scope: ${paSpec.scope ?? ""}`,
    "",
    ...knowledgeLines,
    `Project / product context fingerprint (dominant terms across the uploaded batch):`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `Prior per-process results:`,
    `Base Practices:`,
    bpSummary,
    `Output Work Products:`,
    wpSummary,
    "",
    `Evidence excerpts:`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const citation = knowledge?.references?.pam?.citation;
  const task = [
    `Evaluate this Generic Practice:`,
    `  ${gp.id}: ${gp.title}`,
    gp.description ? `  ${gp.description}` : "",
    "",
    citation
      ? `Score 0-100. Cite exactly "${citation}" as pamCitation.`
      : `Score 0-100. Cite the PAM section for this GP (typically "PAM §5 ${gp.id}").`,
    `Then judge whether the evidence preserves the project / product context:`,
    `  - "consistent" | "partial" | "off-context" | "unknown"`,
    `If "partial" or "off-context" you MUST reduce scorePercent and explain in contextConsistency.note.`,
    ...(knowledge ? [`guidelineCitations: ${GUIDELINE_CITATION_INSTRUCTION}`] : []),
    ...jsonSchemaLines({ withGuideline: Boolean(knowledge) }),
  ].join("\n");

  return { system, context, task };
}

function gpKnowledgeBlocks(k) {
  const pa = k.pa ?? {};
  const g = k.gp ?? {};
  const achievements = (pa.achievements ?? []).map((a) => `  ${a.id}. ${a.text}`);
  const notes = (g.notes ?? []).map((n) => `  ${n}`);
  return [
    "## PAM 4.1 — 프로세스 속성",
    `${pa.id} ${pa.name ?? ""}`.trim(),
    pa.scope ? `범위: ${pa.scope}` : "",
    "달성:",
    ...(achievements.length ? achievements : ["  (없음)"]),
    "",
    "## PAM 4.1 — 평가 대상 GP",
    `${g.id}: ${g.title ?? ""}${g.titleEn ? ` (${g.titleEn})` : ""}`,
    g.description ? `설명: ${g.description}` : "",
    ...(notes.length ? ["비고:", ...notes] : []),
    "",
    ...guidelineBlocks(k.guideline),
  ];
}
