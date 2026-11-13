import { ASSESSOR_PERSONA } from "./assessorPersona.js";
import { guidelineBlocks, exactCitationLine, guidelineCitationsLine, GUIDELINE_CITATIONS_SCHEMA_LINE, formatOutcomes, addNotesLines, titleWithEn } from "./common.js";

/**
 * Build the assessor prompt for one Generic Practice (PA 1.1 ~ 3.2).
 *
 * Project-context check applies here too: GP evidence drawn from off-project
 * artifacts (e.g. another program's planning template) does not demonstrate
 * the GP for *this* project.
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
  const system = ASSESSOR_PERSONA;

  const bpSummary = (bpResults ?? [])
    .map((r) => `  ${r.id}: ${r.rating} (${r.scorePercent}%)`)
    .join("\n") || "  (none)";
  const wpSummary = (wpResults ?? [])
    .map((r) => `  ${r.wpId} ${r.name}: ${r.rating}`)
    .join("\n") || "  (none)";

  const context = [
    `# 평가 컨텍스트`,
    `- Process: ${process.id} ${process.name}`,
    `- Process Attribute: ${paSpec.id} ${paSpec.name} (capability level ${paSpec.level})`,
    `- PA scope: ${paSpec.scope ?? ""}`,
    "",
    ...(knowledge ? gpKnowledgeBlocks(knowledge) : []),
    `# 프로젝트 / 제품 컨텍스트 지문`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `# 선행 평가 결과`,
    `Base Practices:`,
    bpSummary,
    `Output Work Products:`,
    wpSummary,
    "",
    `# 산출물 인용`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const citation = knowledge?.references?.pam?.citation;
  const task = [
    `# 평가 대상 Generic Practice`,
    `  ${gp.id}: ${gp.title}`,
    gp.description ? `  ${gp.description}` : "",
    "",
    `# 작업`,
    `- 0~100 점으로 충족도를 평가하라.`,
    citation
      ? exactCitationLine(citation)
      : `- pamCitation 은 "PAM §5 ${gp.id}" 또는 더 구체적인 인용으로 작성하라.`,
    `- contextConsistency 를 판정하라 ("partial"/"off-context" 인 경우 감점 + note 필수).`,
    `- findings 배열에 최소 1개의 Finding 을 작성하라 (가이드: 시스템 메시지 § Finding 작성 룰).`,
    `  - 각 Finding 의 bpId 는 "${process.id}.${gp.id}" 형식으로 기록하라 (GP 도 동일 필드 사용).`,
    `  - id 는 "F-${process.id}.${gp.id}-NN" 형식으로 부여하라.`,
    ...(knowledge ? [guidelineCitationsLine()] : []),
    "",
    `# 출력 JSON 스키마`,
    `{`,
    `  "scorePercent": <0-100>,`,
    `  "evidence": [{"artifactName": "...", "quote": "..."}],`,
    `  "gaps": ["..."],`,
    `  "pamCitation": "${citation ?? `PAM §5 ${gp.id}`}",`,
    `  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." },`,
    ...(knowledge ? [GUIDELINE_CITATIONS_SCHEMA_LINE] : []),
    `  "standardReferences": {`,
    `    "pam": ["PAM §..."],`,
    `    "pamNote": [],`,
    `    "bgbRL": [],`,
    `    "iso": []`,
    `  },`,
    `  "findings": [`,
    `    {`,
    `      "id": "F-${process.id}.${gp.id}-01",`,
    `      "bpId": "${process.id}.${gp.id}",`,
    `      "type": "weakness|strength|observation",`,
    `      "situation": "<산출물에서 관찰된 객관적 사실 + 결론 진술>",`,
    `      "gap": "<weakness 인 경우>",`,
    `      "impact": "<weakness 인 경우>",`,
    `      "recommendation": "<weakness 인 경우 동사로 시작>",`,
    `      "location": { "found": null, "recommended": null },`,
    `      "evidence": [{"artifactName": "...", "quote": "..."}],`,
    `      "standardReferences": {"pam": [], "pamNote": [], "bgbRL": [], "iso": []},`,
    `      "ratingImpact": {"ruleApplied": false, "ruleId": null, "scoreDelta": 0, "reason": "..."}`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");

  return { system, context, task };
}

function gpKnowledgeBlocks(k) {
  const pa = k.pa ?? {};
  const g = k.gp ?? {};
  return [
    "# PAM 4.1 — 프로세스 속성",
    `${pa.id} ${pa.name ?? ""}`.trim(),
    pa.scope ? `범위: ${pa.scope}` : "",
    "달성:",
    formatOutcomes(pa.achievements),
    "",
    "# PAM 4.1 — 평가 대상 GP",
    `${g.id}: ${titleWithEn(g.title, g.titleEn)}`,
    g.description ? `설명: ${g.description}` : "",
    ...addNotesLines(g.notes),
    "",
    ...guidelineBlocks(k.guideline),
  ];
}
