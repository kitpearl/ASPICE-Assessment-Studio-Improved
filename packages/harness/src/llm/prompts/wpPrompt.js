import { ASSESSOR_PERSONA } from "./assessorPersona.js";

/**
 * Build the assessor prompt for one Output Work Product.
 *
 * The assessor must also confirm that the evidence used to satisfy the WP is
 * from the same product/project context as the rest of the batch. Submitting
 * a perfectly-formed SRS from a different program does not satisfy the WP for
 * *this* program.
 */
export function buildWpPrompt({ process, wp, artifactsExcerpt, projectFingerprint }) {
  const system = ASSESSOR_PERSONA;

  const context = [
    `# 평가 컨텍스트`,
    `- Process: ${process.id} ${process.name}`,
    `- PAM section: ${process.pamSection}`,
    "",
    `# 프로젝트 / 제품 컨텍스트 지문`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `# 산출물 인용`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const task = [
    `# 평가 대상 Output Work Product`,
    `  ${wp.id} ${wp.name}`,
    "",
    `# 작업`,
    `- 이 프로젝트/제품을 위해 ${wp.id} ${wp.name} 이 적절한 특성으로 산출되었다는 증거가 있는가?`,
    `- 0~100 점으로 충족도를 평가하라.`,
    `- pamCitation 은 반드시 "PAM §${process.pamSection}" 형식(§ + 섹션 번호)으로 작성하라. "PAM Annex B ${wp.id}" 같은 Work Product 번호 표기는 pamCitation 에 쓰지 마라 (${wp.id} 는 이미 bpId/finding 에 기록된다).`,
    `- contextConsistency 를 판정하라 ("partial"/"off-context" 인 경우 감점 + note 필수).`,
    `- findings 배열에 최소 1개의 Finding 을 작성하라.`,
    `  - 각 Finding 의 bpId 는 "${process.id}.${wp.id}" 형식으로 기록하라 (WP 도 동일 필드 사용).`,
    `  - id 는 "F-${process.id}.${wp.id}-NN" 형식으로 부여하라.`,
    "",
    `# 출력 JSON 스키마`,
    `{`,
    `  "scorePercent": <0-100>,`,
    `  "evidence": [{"artifactName": "...", "quote": "..."}],`,
    `  "gaps": ["..."],`,
    `  "pamCitation": "PAM §${process.pamSection}",`,
    `  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." },`,
    `  "standardReferences": {"pam": [], "pamNote": [], "bgbRL": [], "iso": []},`,
    `  "findings": [`,
    `    {`,
    `      "id": "F-${process.id}.${wp.id}-01",`,
    `      "bpId": "${process.id}.${wp.id}",`,
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
