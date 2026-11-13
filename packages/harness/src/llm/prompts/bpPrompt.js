import { ASSESSOR_PERSONA } from "./assessorPersona.js";
import { buildIncoseGuidance } from "../../../spec/incose/index.js";
import { guidelineBlocks, exactCitationLine, guidelineCitationsLine, GUIDELINE_CITATIONS_SCHEMA_LINE, formatOutcomes, addNotesLines, titleWithEn } from "./common.js";

/**
 * Build the assessor prompt for one Base Practice.
 *
 * Returns a three-part structure that the LLM client adapters can translate
 * into cached + dynamic message blocks (Anthropic) or a concatenated user
 * message (OpenAI):
 *   - system  : assessor persona + 출력 규약 (stable, cacheable across all calls)
 *   - context : process spec + PAM 4.1 / Guideline 2026 knowledge + evidence excerpt (stable within a process eval)
 *   - task    : BP-specific question (varies per call)
 *
 * Project-context check: the assessor must additionally judge whether each
 * cited piece of evidence preserves the *product / project context* of the
 * batch (i.e. is from the same program/system as the rest of the deliverables).
 * Off-context evidence cannot earn full credit even if it structurally matches
 * the BP description.
 *
 * Mode-independent scoring: the BP scoring prompt is identical whether the run
 * is single-process (/api/analyze) or project (/api/project). An earlier version
 * appended a per-process "Finding 상세화" directive to the dynamic task, but
 * because scorePercent and the findings come from the *same* LLM response, that
 * directive biased single-process runs toward lower scores — the same artifact
 * earned worse BP grades in process mode than in project mode. Keeping the task
 * byte-identical across modes also lets the llmResponseCache (see
 * _harnessService.js) actually converge the two modes onto one verdict per
 * prompt, which is its whole purpose. `mode` is accepted (and ignored) for
 * call-site compatibility.
 *
 * `knowledge` (BpKnowledge from src/knowledge) is optional; when null the
 * context and task are built exactly as before the knowledge layer existed.
 */
export function buildBpPrompt({
  process,
  bp,
  artifactsExcerpt,
  projectFingerprint,
  // eslint-disable-next-line no-unused-vars -- accepted for call-site stability; scoring is mode-independent (see above)
  mode = "project",
  knowledge = null,
}) {
  const system = ASSESSOR_PERSONA;

  const context = [
    `# 평가 컨텍스트`,
    `- Process: ${process.id} ${process.name}`,
    `- PAM section: ${process.pamSection}`,
    `- Process purpose: ${process.purpose}`,
    "",
    ...(knowledge ? bpKnowledgeBlocks(knowledge) : []),
    `# 프로젝트 / 제품 컨텍스트 지문 (업로드 배치의 지배적 용어)`,
    `  ${projectFingerprint || "(unknown)"}`,
    "",
    `# 산출물 인용 (업로드된 work product 들의 발췌)`,
    artifactsExcerpt || "(no artifacts supplied)",
  ].join("\n");

  const bpFullId = `${process.id}.${bp.id}`;

  // INCOSE GtWR V4 렌즈: 요구사항 분석 프로세스(SYS.2/SWE.1/HWE.1)의 BP 에만
  // 비어 있지 않은 가이드가 반환된다. 비적용 BP 의 task/schema 는 기존과
  // byte-identical 로 유지되어 prompt cache 와 회귀 테스트가 깨지지 않는다.
  const incoseGuidance = buildIncoseGuidance(bpFullId);
  const incoseApplicable = Boolean(incoseGuidance);
  const citation = knowledge?.references?.pam?.citation;

  const task = [
    `# 평가 대상 Base Practice`,
    `  ${bpFullId}: ${bp.title}`,
    bp.description ? `  ${bp.description}` : "",
    ...(incoseApplicable ? ["", incoseGuidance] : []),
    "",
    `# 작업`,
    `- 0~100 점으로 충족도를 평가하라.`,
    citation
      ? exactCitationLine(citation)
      : `- pamCitation 은 "PAM §${process.pamSection} ${bp.id}" 또는 더 구체적인 인용으로 작성하라.`,
    `- contextConsistency 를 판정하라: "consistent" | "partial" | "off-context" | "unknown".`,
    `  partial/off-context 인 경우 scorePercent 감점 + note 에 사유 기록 필수.`,
    `- findings 배열에 최소 1개의 Finding 을 작성하라 (가이드: 시스템 메시지 § Finding 작성 룰).`,
    `  - 각 Finding 의 bpId 는 "${bpFullId}" 로 고정하라.`,
    `  - id 는 "F-${bpFullId}-NN" 형식으로 부여하라 (NN 은 01 부터).`,
    ...(incoseApplicable
      ? [
          `- INCOSE GtWR V4 렌즈(위 "# INCOSE GtWR V4 ..." 절)로 요구사항 명세 품질과 검증가능성을 추가 평가하라.`,
          `  요구사항 진술/집합의 INCOSE 특성 위반·충족을 Finding 으로 보고하고, 적용 INCOSE 인용을 standardReferences.incose 에 기록하라 (예: "INCOSE GtWR C7", "INCOSE GtWR R18").`,
        ]
      : []),
    ...(knowledge ? [guidelineCitationsLine()] : []),
    "",
    `# 출력 JSON 스키마`,
    `{`,
    `  "scorePercent": <0-100>,`,
    `  "evidence": [{"artifactName": "...", "quote": "...", "location": "..."}],`,
    `  "gaps": ["..."],`,
    `  "pamCitation": "${citation ?? `PAM §${process.pamSection} ${bp.id}`}",`,
    `  "contextConsistency": { "status": "consistent|partial|off-context|unknown", "note": "..." },`,
    ...(knowledge ? [GUIDELINE_CITATIONS_SCHEMA_LINE] : []),
    `  "standardReferences": {`,
    `    "pam": ["PAM §..."],`,
    `    "pamNote": ["PAM Note ${process.id}-N"],`,
    `    "bgbRL": ["RL3"],`,
    `    "iso": []${incoseApplicable ? "," : ""}`,
    ...(incoseApplicable ? [`    "incose": ["INCOSE GtWR C7", "INCOSE GtWR R18"]`] : []),
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
    `      "standardReferences": {"pam": ["..."], "pamNote": [], "bgbRL": [], "iso": []${incoseApplicable ? ', "incose": ["INCOSE GtWR C7"]' : ""}},`,
    `      "ratingImpact": {"ruleApplied": false, "ruleId": null, "scoreDelta": 0, "reason": "..."}`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");

  return { system, context, task };
}

function bpKnowledgeBlocks(k) {
  const p = k.process ?? {};
  const b = k.bp ?? {};
  const wps = (k.outputWorkProducts ?? []).map((w) => `- ${w.id} ${w.name}`);
  return [
    "# PAM 4.1 — 프로세스",
    `${p.id} ${p.name ?? ""}`.trim(),
    `목적: ${p.purpose ?? ""}`,
    "성과:",
    formatOutcomes(p.outcomes),
    "",
    "# PAM 4.1 — 평가 대상 BP",
    `${p.id}.${b.id}: ${titleWithEn(b.title, b.titleEn)}`,
    b.description ? `설명: ${b.description}` : "",
    ...addNotesLines(b.notes),
    "",
    "# 출력 정보 항목",
    ...(wps.length ? wps : ["(없음)"]),
    "",
    ...guidelineBlocks(k.guideline),
  ];
}
