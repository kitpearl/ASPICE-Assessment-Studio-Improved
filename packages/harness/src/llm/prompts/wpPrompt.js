import { formatWpCharacteristics } from "../../knowledge/index.js";
import { SYSTEM_PREFIX, LANGUAGE_AND_QUOTE_RULES, jsonSchemaLines } from "./common.js";

/**
 * Build the assessor prompt for one Output Work Product.
 *
 * The assessor must also confirm that the evidence used to satisfy the WP is
 * from the same product/project context as the rest of the batch. Submitting
 * a perfectly-formed SRS from a different program does not satisfy the WP for
 * *this* program.
 *
 * `knowledge` (WpKnowledge) is optional; null keeps the pre-knowledge context.
 */
export function buildWpPrompt({ process, wp, artifactsExcerpt, projectFingerprint, knowledge = null }) {
  const system = `${SYSTEM_PREFIX} You judge whether submitted evidence satisfies the existence and characteristics of a declared Output Work Product, AND whether that evidence belongs to the same product/project context as the rest of the deliverables. Cite PAM 4.1 §X.Y.Z or PAM 4.1 Annex B NN-NN. Return JSON ONLY. ${LANGUAGE_AND_QUOTE_RULES}`;

  const characteristics = knowledge ? formatWpCharacteristics(knowledge.wp) : "";
  const knowledgeLines = knowledge
    ? ["## PAM 4.1 — 정보 항목 특징", characteristics || "(특징 정보 없음)", ""]
    : [];

  const context = [
    `Process: ${process.id} ${process.name}`,
    `PAM section: ${process.pamSection}`,
    "",
    ...knowledgeLines,
    `Project / product context fingerprint (dominant terms across the uploaded batch):`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `Evidence excerpts:`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const citation = knowledge?.references?.pam?.citation;
  const task = [
    `Evaluate this Output Work Product:`,
    `  ${wp.id} ${wp.name}`,
    "",
    `Is there evidence that ${wp.id} ${wp.name} was produced with appropriate characteristics for THIS project/product?`,
    citation
      ? `Score 0-100 for extent of achievement. Cite exactly "${citation}" as pamCitation.`
      : `Score 0-100 for extent of achievement. Cite PAM §${process.pamSection} or Annex B ${wp.id}.`,
    `Then judge whether the evidence preserves the project / product context:`,
    `  - "consistent" | "partial" | "off-context" | "unknown"`,
    `If "partial" or "off-context" you MUST reduce scorePercent and explain in contextConsistency.note.`,
    ...jsonSchemaLines(),
  ].join("\n");

  return { system, context, task };
}
