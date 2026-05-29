import { ASSESSOR_PERSONA } from "./assessorPersona.js";

/**
 * Build the assessor prompt for one Base Practice.
 *
 * Returns a three-part structure that the LLM client adapters can translate
 * into cached + dynamic message blocks (Anthropic) or a concatenated user
 * message (OpenAI):
 *   - system  : assessor persona + 출력 규약 (stable, cacheable across all calls)
 *   - context : process spec + evidence excerpt (stable within a process eval)
 *   - task    : BP-specific question (varies per call)
 *
 * Project-context check: the assessor must additionally judge whether each
 * cited piece of evidence preserves the *product / project context* of the
 * batch (i.e. is from the same program/system as the rest of the deliverables).
 * Off-context evidence cannot earn full credit even if it structurally matches
 * the BP description.
 */
export function buildBpPrompt({
  process,
  bp,
  artifactsExcerpt,
  projectFingerprint,
}) {
  const system = ASSESSOR_PERSONA;

  const context = [
    `# 평가 컨텍스트`,
    `- Process: ${process.id} ${process.name}`,
    `- PAM section: ${process.pamSection}`,
    `- Process purpose: ${process.purpose}`,
    "",
    `# 프로젝트 / 제품 컨텍스트 지문 (업로드 배치의 지배적 용어)`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `# 산출물 인용 (업로드된 work product 들의 발췌)`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const bpFullId = `${process.id}.${bp.id}`;
  const task = [
    `# 평가 대상 Base Practice`,
    `  ${bpFullId}: ${bp.title}`,
    bp.description ? `  ${bp.description}` : "",
    "",
    `# 작업`,
    `- 0~100 점으로 충족도를 평가하라.`,
    `- pamCitation 은 "PAM §${process.pamSection} ${bp.id}" 또는 더 구체적인 인용으로 작성하라.`,
    `- contextConsistency 를 판정하라: "consistent" | "partial" | "off-context" | "unknown".`,
    `  partial/off-context 인 경우 scorePercent 감점 + note 에 사유 기록 필수.`,
    `- findings 배열에 최소 1개의 Finding 을 작성하라 (가이드: 시스템 메시지 § Finding 작성 룰).`,
    `  - 각 Finding 의 bpId 는 "${bpFullId}" 로 고정하라.`,
    `  - id 는 "F-${bpFullId}-NN" 형식으로 부여하라 (NN 은 01 부터).`,
    "",
    `# 출력 JSON 스키마`,
    `{`,
    `  "scorePercent": <0-100>,`,
    `  "evidence": [{"artifactName": "...", "quote": "...", "location": "..."}],`,
    `  "gaps": ["..."],`,
    `  "pamCitation": "PAM §...",`,
    `  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." },`,
    `  "standardReferences": {`,
    `    "pam": ["PAM §..."],`,
    `    "pamNote": ["PAM Note ${process.id}-N"],`,
    `    "bgbRL": ["RL3"],`,
    `    "iso": ["ISO 26262-6:2018 §8.4.5"]`,
    `  },`,
    `  "findings": [`,
    `    {`,
    `      "id": "F-${bpFullId}-01",`,
    `      "bpId": "${bpFullId}",`,
    `      "type": "weakness|strength|observation",`,
    `      "situation": "<산출물에서 관찰된 객관적 사실 + 결론 진술>",`,
    `      "gap": "<weakness 인 경우 무엇이 부족한지 구체적 진술>",`,
    `      "impact": "<weakness 인 경우 BP outcome / capability 에 미치는 영향>",`,
    `      "recommendation": "<weakness 인 경우 동사로 시작하는 권고>",`,
    `      "location": { "found": "<발견 위치 또는 null>", "recommended": "<부재 시 권고 위치 또는 null>" },`,
    `      "evidence": [{"artifactName": "...", "quote": "..."}],`,
    `      "standardReferences": {"pam": ["..."], "pamNote": [], "bgbRL": [], "iso": []},`,
    `      "ratingImpact": {"ruleApplied": false, "ruleId": null, "scoreDelta": 0, "reason": "..."}`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");

  return { system, context, task };
}
