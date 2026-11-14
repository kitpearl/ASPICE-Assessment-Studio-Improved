// 기존 하네스 ProcessVerdict(BP 점수·Finding·적용 규칙) → 구조화 assessment 변환기.
// 기존 평가 결과는 바꾸지 않는다. 새 구조는 옆에 추가로 만든다(supersedes 로 기존 평가와 구분).
import { loadProcess } from "../../spec/canonical/index.js";
import { percentToRating } from "../model/rating.js";
import { buildAssessment, manifestEntry } from "./buildAssessment.js";
import { ENGINE_VERSION, PROMPT_VERSION_NONE } from "./constants.js";
import { BP_PROMPT_VERSION } from "../llm/prompts/bpPrompt.js";
import { normalizeExpectations, bestExpectationFor } from "./expectations.js";
import { conceptOfTerm, conceptsIn, isFunctionWord } from "./semantics.js";

const TYPE_MAP = { strength: "STRENGTH", weakness: "WEAKNESS", observation: "OBSERVATION" };
const OUTCOMES = ["Approve", "Reject", "Defer"];
// 규칙 스코어러의 키워드 미확인 gap: "No evidence found for keywords: a, b" (하이브리드는 "[rule] " 접두)
const GAP_KEYWORDS_RE = /(?:No evidence found for keywords|키워드 증거 미발견):\s*(.+)$/;
const ABSENCE_WORDING = /(없|부족|누락|않|미흡|불명확|확인되지|미정의|미비)/;

/**
 * @param {any} verdict ProcessVerdict
 * @param {{artifacts?: Array<{name: string, text?: string}>, skipped?: Array<{name: string, reason?: string}>, engines?: string[], assessmentId?: string}} [ctx]
 */
export function assessmentFromVerdict(verdict, { artifacts = [], skipped = [], engines = [], assessmentId, supersedes = null } = {}) {
  const processSpec = loadProcess(verdict.processId);
  if (!processSpec) throw new Error(`Unknown process: ${verdict.processId}`);
  const usesLlm = engines.some((e) => e === "llm" || e === "hybrid");
  const ruleOnly = engines.length === 1 && engines[0] === "rule";

  // 입력 목록: 읽은 파일 + 읽지 못한 파일(판독 불가를 '증거 없음'으로 취급하지 않기 위해 FAILED 로 남긴다)
  const manifest = [
    ...artifacts.map((a) => manifestEntry({ fileName: a.name, content: a.text ?? "", extractionStatus: a.text ? "OK" : "FAILED" })),
    ...skipped.map((s) => manifestEntry({ fileName: s.name, extractionStatus: "FAILED", unreadableRanges: [s.reason ?? "unreadable"] })),
  ];
  const docId = new Map(manifest.map((m) => [m.fileName, m.documentId]));
  const fallbackDoc = manifest[0]?.documentId;

  const evidence = [];
  const evidenceKey = new Map();
  const evidenceFor = (e) => {
    const quote = String(e?.quote ?? "").trim();
    if (!quote) return null;
    const documentId = docId.get(e.artifactName) ?? fallbackDoc;
    if (!documentId) return null;
    const key = `${documentId}|${e.location ?? ""}|${quote}`;
    if (evidenceKey.has(key)) return evidenceKey.get(key);
    const id = `EV-${String(evidence.length + 1).padStart(4, "0")}`;
    evidence.push({
      evidenceId: id,
      documentId,
      locator: { page: Number.isInteger(e.page) ? e.page : null, section: e.location ?? null, table: null, paragraph: null, cell: null },
      quote: quote.slice(0, 600),
      evidenceType: "PLAN", // 제출 문서 본문은 계획·정의 증거다. 수행 기록으로 분류하지 않는다.
      extractionConfidence: null,
      verificationStatus: "UNVERIFIED",
    });
    evidenceKey.set(key, id);
    return id;
  };

  const expectations = normalizeExpectations(processSpec);
  const findings = [];
  const provisionalRatings = {};
  const restoredNotes = {};
  const retrievalScores = {};
  const conditionInputs = {};
  for (const bp of verdict.bps ?? []) {
    const key = `${verdict.processId}.${bp.id}`;
    if (!processSpec.basePractices.some((b) => b.id === bp.id)) continue; // 사용자 정의 BP 는 공식 BP 가 아니다
    // 기존 평가기는 LLM 이 "적용했다"고 주장한 규칙(조건 성립 미검증)의 상한으로 점수를 이미 깎았을 수 있다.
    // 그 경우 깎이기 전 점수로 임시 등급을 잡고, 규칙은 새 규칙 처리기가 UNKNOWN(검토 대기)으로 다룬다.
    const unverifiedCap = (bp.appliedRules ?? []).some((r) => r?.capped === true && r?.source !== "rule-engine");
    const restored = unverifiedCap && typeof bp.scoreBeforeGuidelineCaps === "number" && bp.scoreBeforeGuidelineCaps > bp.scorePercent;
    provisionalRatings[key] = restored ? percentToRating(bp.scoreBeforeGuidelineCaps) : bp.rating;
    if (restored) restoredNotes[key] = `기존 평가기는 LLM 의 규칙 적용 주장(미검증)으로 점수를 ${bp.scoreBeforeGuidelineCaps}% → ${bp.scorePercent}% 로 낮췄다. 구조화 평가는 깎이기 전 점수(${bp.scoreBeforeGuidelineCaps}%)의 등급을 임시 등급으로 쓰고 해당 규칙은 조건 확인 전까지 검토 대기로 둔다.`;
    if (ruleOnly) retrievalScores[key] = bp.scorePercent;
    const bpExpectations = expectations.filter((e) => e.bpId === bp.id);
    for (const f of bp.findings ?? []) {
      const ids = (f.evidence ?? []).map(evidenceFor).filter(Boolean);
      const findingType = TYPE_MAP[f.type] ?? "OBSERVATION";
      const claim = [f.situation, f.gap].filter((s) => typeof s === "string" && s.trim()).join(" ").trim();
      // 강점·약점 지적을 같은 BP 의 기대사항에 후보 매핑한다(충돌 탐지용). 모호하면 BP 수준으로 둔다.
      // LLM 이 구조화해 준 기대사항 ID 가 이 BP 의 실제 기대사항일 때만 신뢰한다(환각 ID 는 버린다). 없으면 후보 매핑.
      const validIds = new Set(bpExpectations.map((e) => e.expectationId));
      const declared = (f.expectationIds ?? []).filter((id) => validIds.has(id));
      // 응답이 expectationIds 를 명시했으면(빈 배열 = 특정 기대사항에 속하지 않음) 후보 매핑으로 덮어쓰지 않는다.
      const mapped = findingType === "OBSERVATION" || f.expectationIdsDeclared === true || declared.length ? null : bestExpectationFor(claim, bpExpectations);
      // 약점이 "…이 없다/부족하다"는 부재 주장이고 개념이 하나로 특정되면 반대 증거를 찾는다.
      // 문장 해석이 확실하지 않으므로 기각이 아니라 보류(conservativeAbsence)로만 처리한다.
      // LLM 이 absenceClaim 을 구조화해 주면 그것을 쓴다: 대상 개념은 사전에서 찾고, 대체 표현은 별도 검색한다.
      const structured = f.absenceClaim?.target ? { // 대상이 사전의 표면형과 정확히 일치할 때만 개념으로 본다. 긴 서술형 대상("…기록 항목")에서 단어 하나가 우연히 사전과 맞는 것을 개념으로 오인하지 않는다.
        conceptId: conceptOfTerm(f.absenceClaim.target) ?? undefined,
        relatedConcepts: [...conceptsIn(f.absenceClaim.target)], target: f.absenceClaim.target, terms: f.absenceClaim.alternativeTerms ?? [], claim } : null;
      const concepts = !structured && findingType === "WEAKNESS" && ABSENCE_WORDING.test(claim) ? [...conceptsIn(claim)] : [];
      findings.push({
        findingId: f.id,
        bpId: key,
        expectationIds: declared.length ? declared : mapped ? [mapped] : [],
        ...(f.claimsExecution ? { executionClaim: true } : {}),
        ...(structured ? { absenceClaim: structured, conservativeAbsence: true } : {}),
        ...(concepts.length === 1 ? { absenceClaim: { conceptId: concepts[0], claim }, conservativeAbsence: true } : {}),
        findingType,
        claim,
        evidenceIds: ids,
        significanceRationale: f.impact ?? "",
        sourceEngine: String(f.id ?? "").startsWith("F-rule-") ? "RULE" : "LLM",
        disposition: "ACCEPTED",
        dispositionReason: "",
      });
    }
    // 규칙 스코어러의 키워드 미확인은 "부재 주장"이 아니라 검색 후보다. 기능어는 요구사항이 아니므로 기각하고,
    // 동의어 개념이 본문에 있으면(개시자≈제안자 등) 반대 증거로 기각한다. 개념 사전에 없는 키워드는 후보로만 남긴다.
    for (const g of bp.gaps ?? []) {
      const m = GAP_KEYWORDS_RE.exec(String(g).replace(/^\[(rule|규칙)\]\s*/i, ""));
      if (!m) continue;
      for (const kw of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
        const base = { findingId: `F-gap-${key}-${kw}`, bpId: key, expectationIds: [], findingType: "OBSERVATION", claim: `규칙 스코어러: '${kw}' 키워드 미확인(증거 후보 검색 결과)`, evidenceIds: [], significanceRationale: "", sourceEngine: "RULE" };
        if (isFunctionWord(kw)) {
          findings.push({ ...base, disposition: "REJECTED", dispositionReason: "기능어(조사·접속 표현)는 독립 요구사항이 아니므로 부재를 약점으로 세지 않는다." });
          continue;
        }
        const conceptId = conceptOfTerm(kw);
        findings.push(conceptId ? { ...base, absenceClaim: { conceptId, claim: base.claim }, disposition: "ACCEPTED", dispositionReason: "" } : { ...base, disposition: "ACCEPTED", dispositionReason: "개념 사전에 없어 반대 증거를 검색하지 못했다. 후보로만 남긴다." });
      }
    }
    // LLM 이 "적용했다"고 주장한 규칙은 적용 후보일 뿐이다. 조건 성립은 검증되지 않았으므로 UNKNOWN 으로 둔다.
    for (const r of bp.appliedRules ?? []) {
      if (r?.source === "rule-engine" || !r?.ruleId) continue;
      conditionInputs[r.ruleId] = { rationale: `LLM 적용 주장(미검증): ${r.applied ? "적용" : "미적용"}${r.note ? ` — ${r.note}` : ""}` };
    }
  }

  const blocks = [];
  const outcomeHits = new Set();
  for (const a of artifacts) {
    const lines = String(a.text ?? "").split(/\r?\n/);
    lines.forEach((t, i) => {
      const text = t.trim();
      if (!text) return;
      for (const o of OUTCOMES) if (text.includes(o)) outcomeHits.add(o);
      blocks.push({ documentId: docId.get(a.name), text, locator: { paragraph: i + 1 } });
    });
  }

  // 이 프로세스에 해당하는 입력 문서가 없으면 키워드 점수에서 나온 N 등을 등급으로 싣지 않는다(문서 부재 ≠ 프로세스 미수행).
  // 읽지 못한 파일(FAILED)만 입력 목록에 있어도 실제로 평가에 쓰인 문서가 없으면 "입력 없음"이다.
  const noInput = artifacts.length === 0;
  const a = buildAssessment({
    processSpec,
    scope: "DOCUMENT_ADEQUACY", // 이 제품은 제출 문서를 평가한다. 수행 기록이 없으므로 PA/CL 달성은 판정하지 않는다.
    assessmentId: assessmentId ?? `ASM-${verdict.processId}-${Date.now()}`,
    supersedes,
    manifest,
    blocks,
    evidence,
    findings,
    expectations,
    provisionalRatings: noInput ? {} : provisionalRatings,
    retrievalScores: noInput ? {} : retrievalScores,
    conditionInputs,
    decisionOutcomes: outcomeHits.size >= 2 ? OUTCOMES : null,
    decisionAliases: { Defer: ["보류", "연기"] },
    versions: {
      engineVersion: `${ENGINE_VERSION}; scorers=${engines.join("+") || "unknown"}`,
      promptVersion: usesLlm ? BP_PROMPT_VERSION : PROMPT_VERSION_NONE,
    },
  });
  for (const [key, note] of Object.entries(restoredNotes)) {
    const bp = a.bpResults.find((b) => b.bpId === key);
    if (bp) bp.rating.rationale = `${bp.rating.rationale} ${note}`;
  }
  if (noInput) {
    a.consistencyChecks.push({ checkId: "INPUT-MISSING", status: "REVIEW", detail: "이 프로세스에 해당하는 입력 문서가 없어 등급을 제시하지 않는다(문서 부재는 프로세스 미수행이 아니다)." });
  }
  return a;
}
