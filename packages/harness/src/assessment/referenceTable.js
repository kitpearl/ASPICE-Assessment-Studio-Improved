// 심사자 참조 판정표 로더/검증/렌더러 (프로세스 비종속).
// 큐레이션된 표(spec/reference/<PROCESS>.reference.js)가 있으면 그것을, 없으면 PAM·가이드라인에서
// 자동 생성한 "골격(SKELETON)"을 돌려준다. 골격은 기대사항·관련 규칙만 채우고 판정은 모두 비워 둔다.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { loadProcess, loadGuideline } from "../../spec/canonical/index.js";
import { selectRulesForBp } from "../knowledge/select.js";
import { normalizeExpectations } from "./expectations.js";
import { classifyEffect } from "./ruleEngine.js";
import { CLASSIFICATIONS, CONDITION_RESULTS, EVIDENCE_STATUSES } from "./constants.js";

const here = dirname(fileURLToPath(import.meta.url));
const refDir = resolve(here, "../../spec/reference");

export function buildReferenceSkeleton(processId) {
  const proc = loadProcess(processId);
  if (!proc) throw new Error(`Unknown process: ${processId}`);
  const rules = loadGuideline().rules ?? [];
  const exps = normalizeExpectations(proc);
  return {
    schemaVersion: "reference-judgment/1.0.0",
    processId,
    status: "REVIEWER_REFERENCE_DRAFT",
    curation: "SKELETON",
    assessmentScope: "DOCUMENT_ADEQUACY",
    disclaimer: "자동 생성 골격이다. 원문 증거·판정은 비어 있고 심사자가 채워야 한다. 등급·판정을 포함하지 않는다.",
    documents: [],
    evidence: [],
    documentBpMapping: { documentBpCount: null, officialBpCount: proc.basePractices.length, rows: [], caveat: "문서 자체 BP 구성은 문서를 열람해야 알 수 있다." },
    bps: proc.basePractices.map((bp) => {
      const bpKey = `${processId}.${bp.id}`;
      return {
        bpId: bpKey,
        title: bp.title,
        officialExpectation: { citation: bp.pamCitation ?? `PAM 4.1 ${proc.pamSection ?? ""} ${bpKey}`.trim(), textKo: bp.description ?? "", textEn: bp.descriptionEn ?? "" },
        documentCorrespondence: "",
        expectations: exps.filter((e) => e.bpId === bp.id).map((e) => ({
          expectationId: e.expectationId,
          summary: e.textKo,
          positiveEvidenceIds: [],
          documentStatusDraft: null,
          weaknesses: [],
          needsExecutionEvidence: [],
        })),
        relatedRules: selectRulesForBp(rules, proc, bp).map((r) => ({
          ruleId: r.id,
          effectType: classifyEffect(r).type,
          conditionResult: "UNKNOWN",
          conditionEvidenceIds: [],
          rationale: r.textEn ?? r.text ?? "",
          neededInfo: "심사자 판단 필요",
        })),
        engineJudgments: [],
        omissions: [],
        reviewerQuestions: [],
      };
    }),
    documentConsistency: [],
    reportLevelIssues: [],
    unreviewedInputs: [],
  };
}

/** 큐레이션된 표가 있으면 그것을, 없으면 골격을 돌려준다. */
export async function loadReferenceTable(processId) {
  const file = resolve(refDir, `${processId}.reference.js`);
  if (existsSync(file)) {
    const mod = await import(pathToFileURL(file).href);
    const key = Object.keys(mod).find((k) => k.endsWith("_REFERENCE"));
    if (key) return mod[key];
  }
  return buildReferenceSkeleton(processId);
}

/** 참조 판정표 구조 검증. 확정 등급 필드 금지, 증거·규칙 참조 무결성, 분류 값 검증. */
export function validateReferenceTable(table) {
  const problems = [];
  const p = (m) => problems.push(m);
  const proc = loadProcess(table.processId);
  if (!proc) return [`알 수 없는 프로세스 ${table.processId}`];
  const ruleIds = new Set((loadGuideline().rules ?? []).map((r) => r.id));
  const evIds = new Set((table.evidence ?? []).map((e) => e.evidenceId));
  const officialBps = new Set(proc.basePractices.map((b) => `${table.processId}.${b.id}`));
  if (table.bps.length !== proc.basePractices.length) p(`BP 개수 ${table.bps.length} ≠ 공식 PAM ${proc.basePractices.length}`);
  const forbidden = (obj, where) => {
    for (const k of ["rating", "finalRating", "provisionalRating", "ratingValue", "capabilityLevel"]) if (k in obj) p(`${where}: 참조 판정표에 확정 등급 필드 '${k}' 를 둘 수 없다`);
  };
  forbidden(table, "table");
  const refs = (ids, where) => { for (const id of ids ?? []) if (!evIds.has(id)) p(`${where}: 존재하지 않는 evidenceId ${id}`); };
  for (const bp of table.bps) {
    forbidden(bp, bp.bpId);
    if (!officialBps.has(bp.bpId)) p(`${bp.bpId}: 공식 PAM BP 가 아니다`);
    if (!bp.officialExpectation?.citation) p(`${bp.bpId}: 공식 기대사항 출처가 없다`);
    for (const e of bp.expectations) {
      refs(e.positiveEvidenceIds, e.expectationId);
      if (e.documentStatusDraft != null && !EVIDENCE_STATUSES.includes(e.documentStatusDraft)) p(`${e.expectationId}: 잘못된 상태 ${e.documentStatusDraft}`);
    }
    for (const r of bp.relatedRules) {
      if (!ruleIds.has(r.ruleId)) p(`${bp.bpId}: 알 수 없는 규칙 ${r.ruleId}`);
      if (!CONDITION_RESULTS.includes(r.conditionResult)) p(`${r.ruleId}: 잘못된 conditionResult ${r.conditionResult}`);
      refs(r.conditionEvidenceIds, r.ruleId);
      if ((r.conditionResult === "TRUE" || r.conditionResult === "FALSE") && !(r.conditionEvidenceIds ?? []).length) p(`${r.ruleId}: 조건 ${r.conditionResult} 에는 증거가 필요하다`);
    }
    for (const j of bp.engineJudgments) {
      if (!CLASSIFICATIONS.includes(j.classification)) p(`${j.claimId}: 잘못된 분류 ${j.classification}`);
      refs(j.evidenceIds, j.claimId);
      if ((j.classification === "FALSE_POSITIVE" || j.classification === "VALID") && !String(j.rationale ?? "").trim()) p(`${j.claimId}: 분류 근거가 필요하다`);
    }
    for (const o of bp.omissions) {
      if (!["CONFIRMED_FROM_SOURCE", "UNDETERMINED"].includes(o.status)) p(`${o.omissionId}: 잘못된 상태`);
      if (o.status === "CONFIRMED_FROM_SOURCE") refs(o.evidenceIds, o.omissionId);
    }
  }
  for (const o of table.documentConsistency ?? []) refs(o.evidenceIds, o.omissionId);
  return problems;
}

const mdEsc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReferenceMarkdown(t) {
  const L = [];
  const evById = new Map((t.evidence ?? []).map((e) => [e.evidenceId, e]));
  const loc = (id) => {
    const e = evById.get(id);
    return e ? `${id} (§${e.locator.section}${e.locator.cell ? ` · ${e.locator.cell}` : ""})` : id;
  };
  L.push(`# ${t.processId} BP별 심사자 참조 판정표 (${t.curation === "CURATED" ? "초안" : "골격"})`);
  L.push("");
  L.push(`> ${t.disclaimer}`);
  L.push("");
  L.push(`- 평가 범위: ${t.assessmentScope} (문서 적절성 검토 — 실제 PA/CL 달성 아님)`);
  L.push(`- 큐레이션: ${t.curation}`);
  for (const d of t.documents ?? []) L.push(`- 문서: ${d.fileName} · sha256 ${d.contentHash} · ${d.documentVersion ?? "-"} · 추출 ${d.extractionStatus}`);
  L.push("");
  if (t.documentBpMapping?.rows?.length) {
    L.push(`## 문서 자체 BP(${t.documentBpMapping.documentBpCount}) ↔ 공식 PAM BP(${t.documentBpMapping.officialBpCount})`);
    L.push("");
    L.push("| 문서 BP | 공식 BP | 대응 | 비고 |");
    L.push("|---|---|---|---|");
    for (const r of t.documentBpMapping.rows) L.push(`| ${mdEsc(r.documentBp)} | ${r.officialBps.join(", ") || "-"} | ${r.match} | ${mdEsc(r.note)} |`);
    L.push("");
    L.push(`> ${t.documentBpMapping.caveat}`);
    L.push("");
  }
  for (const bp of t.bps) {
    L.push(`## ${bp.bpId} ${bp.title}`);
    L.push("");
    L.push(`**공식 기대사항** (${bp.officialExpectation.citation})`);
    L.push(`- KO: ${bp.officialExpectation.textKo}`);
    L.push(`- EN: ${bp.officialExpectation.textEn}`);
    if (bp.documentCorrespondence) L.push(`- 문서 대응: ${bp.documentCorrespondence}`);
    L.push("");
    L.push("### 기대사항별 증거");
    L.push("");
    for (const e of bp.expectations) {
      L.push(`- **${e.expectationId}** ${e.summary} — 문서 적절성 초안 상태: \`${e.documentStatusDraft ?? "미판정"}\``);
      if (e.positiveEvidenceIds.length) L.push(`  - 인정 가능한 긍정 증거: ${e.positiveEvidenceIds.map(loc).join("; ")}`);
      for (const w of e.weaknesses) L.push(`  - 확인된 약점: ${w}`);
      for (const n of e.needsExecutionEvidence) L.push(`  - 추가 수행 증거 필요: ${n}`);
    }
    L.push("");
    if (bp.relatedRules.length) {
      L.push("### 관련 규칙과 조건 성립 여부");
      L.push("");
      L.push("| 규칙 | 효과 | 조건 | 판단 근거 · 필요한 정보 |");
      L.push("|---|---|---|---|");
      for (const r of bp.relatedRules) L.push(`| ${r.ruleId} | ${r.effectType} | **${r.conditionResult}** | ${mdEsc(r.rationale)} ⟶ ${mdEsc(r.neededInfo)} |`);
      L.push("");
    }
    if (bp.engineJudgments.length) {
      L.push("### Rule·LLM·Hybrid 지적 판정");
      L.push("");
      L.push("| 엔진 | 지적 | 분류 | 근거 |");
      L.push("|---|---|---|---|");
      for (const j of bp.engineJudgments) L.push(`| ${j.engine} | ${mdEsc(j.claim)} | **${j.classification}** | ${mdEsc(j.rationale)} ${j.evidenceIds.length ? `[${j.evidenceIds.join(", ")}]` : ""} |`);
      L.push("");
    }
    if (bp.omissions.length) {
      L.push("### 누락된 중요 검토 사항");
      L.push("");
      for (const o of bp.omissions) L.push(`- **${o.omissionId}** [${o.status}] ${o.text} ${o.evidenceIds.length ? `(${o.evidenceIds.join(", ")})` : ""}`);
      L.push("");
    }
    if (bp.reviewerQuestions.length) {
      L.push("### 심사자 확인 질문");
      L.push("");
      bp.reviewerQuestions.forEach((q, i) => L.push(`${i + 1}. ${q}`));
      L.push("");
    }
  }
  if (t.documentConsistency?.length) {
    L.push("## 문서 수준 일관성·누락 항목");
    L.push("");
    for (const o of t.documentConsistency) L.push(`- **${o.omissionId}** [${o.status}] ${o.text} ${o.evidenceIds.length ? `(${o.evidenceIds.join(", ")})` : ""}${o.note ? ` — ${o.note}` : ""}`);
    L.push("");
  }
  if (t.reportLevelIssues?.length) {
    L.push("## 엔진 리포트 수준 이슈");
    L.push("");
    for (const i of t.reportLevelIssues) L.push(`- **${i.issueId}** [${i.classification}] ${i.text} — ${i.evidence}`);
    L.push("");
  }
  if (t.unreviewedInputs?.length) {
    L.push("## 열람하지 못한 자료 (필요 범위)");
    L.push("");
    for (const u of t.unreviewedInputs) L.push(`- ${u.fileName} — ${u.neededRange} (${u.reason})`);
    L.push("");
  }
  L.push("## 증거 목록");
  L.push("");
  L.push("| ID | 위치 | 유형 | 인용 |");
  L.push("|---|---|---|---|");
  for (const e of t.evidence ?? []) L.push(`| ${e.evidenceId} | §${e.locator.section}${e.locator.table ? ` · ${mdEsc(e.locator.table)}` : ""}${e.locator.cell ? ` · ${mdEsc(e.locator.cell)}` : ""} | ${e.evidenceType} | ${mdEsc(e.quote)} |`);
  L.push("");
  return L.join("\n");
}
