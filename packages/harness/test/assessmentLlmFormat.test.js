// LLM 출력 형식 변경(기대사항 ID·부재 주장·실행 단정) 회귀 테스트. 외부 LLM 호출 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcess } from "../spec/canonical/index.js";
import { buildBpPrompt, BP_PROMPT_VERSION } from "../src/llm/prompts/bpPrompt.js";
import { normalizeFindings } from "../src/evaluators/citationGuard.js";
import { reconcileAbsenceClaim } from "../src/assessment/evidenceReasoning.js";
import { assessmentFromVerdict } from "../src/assessment/fromVerdict.js";
import { validateAssessment } from "../src/assessment/invariants.js";
import { REAL_BODY } from "./fixtures/sup10Blocks.js";

const sup10 = loadProcess("SUP.10");
const text = REAL_BODY.map((b) => b.text).join("\n");

test("프롬프트: 이 BP 의 기대사항 목록과 새 필드(expectationIds·absenceClaim·claimsExecution)를 요구하고 버전을 노출한다", () => {
  const bp = sup10.basePractices.find((b) => b.id === "BP1");
  const { task } = buildBpPrompt({ process: sup10, bp, artifactsExcerpt: "x", projectFingerprint: "" });
  assert.match(task, /# 기대사항 목록/);
  assert.match(task, /SUP\.10\.BP1\.E1:/);
  assert.match(task, /SUP\.10\.BP1\.E3:/);
  assert.doesNotMatch(task, /SUP\.10\.BP2\.E1:/, "다른 BP 의 기대사항은 섞이지 않는다");
  assert.match(task, /"expectationIds": \["SUP\.10\.BP1\.E1"\]/);
  assert.match(task, /"absenceClaim": null/);
  assert.match(task, /"claimsExecution": false/);
  assert.match(task, /기능어의 부재는 약점이 아니다/);
  assert.match(BP_PROMPT_VERSION, /^bp-prompt\/\d+\.\d+\.\d+$/);
});

test("Finding 정규화: 새 필드는 형식에 맞는 것만 보존하고 잘못된 값은 안전하게 버린다 [synthetic]", () => {
  const base = { id: "F-1", bpId: "SUP.10.BP1", type: "strength", situation: "s", gap: "", impact: "", recommendation: "" };
  const { findings } = normalizeFindings([
    { ...base, expectationIds: ["SUP.10.BP1.E2", 3, " "], absenceClaim: { target: "개시자", alternativeTerms: ["제안자", "a", 7] }, claimsExecution: true },
    { ...base, id: "F-2", expectationIds: "x", absenceClaim: "없음", claimsExecution: "yes" },
    { ...base, id: "F-3" },
  ]);
  assert.deepEqual(findings[0].expectationIds, ["SUP.10.BP1.E2"]);
  assert.deepEqual(findings[0].absenceClaim, { target: "개시자", alternativeTerms: ["제안자"] });
  assert.equal(findings[0].claimsExecution, true);
  assert.deepEqual(findings[1].expectationIds, []);
  assert.equal(findings[1].absenceClaim, null);
  assert.equal(findings[1].claimsExecution, false);
  assert.deepEqual(findings[2].expectationIds, [], "필드가 없으면 빈 값(하위 호환)");
});

test("부재 주장: 개념 사전에 없는 대상은 LLM 이 준 대체 표현이 본문에 있어도 약점을 가리지 않고 확인 사유만 남긴다 [synthetic]", () => {
  const blocks = [{ text: "변경 책임 부서가 요청을 등록한다", locator: { section: "4" } }];
  const r = reconcileAbsenceClaim({ target: "발의 부서", terms: ["책임 부서"], claim: "x" }, blocks);
  // LLM 이 스스로 낸 대체 표현만으로는 약점을 가리지 않는다(ACCEPTED 유지, 심사자 확인 사유만 남김)
  assert.equal(r.disposition, "ACCEPTED");
  assert.ok(r.counterEvidence.length > 0);
  assert.match(r.reason, /대체 표현/);
  const none = reconcileAbsenceClaim({ target: "발의 부서", terms: ["없는표현"], claim: "x" }, blocks);
  assert.equal(none.disposition, "ACCEPTED");
});

const verdictWith = (findings) => ({ processId: "SUP.10", bps: [{ id: "BP1", title: "t", rating: "L", scorePercent: 70, evidence: [], gaps: [], appliedRules: [], findings }] });
const F = (o) => ({ id: "F-SUP.10.BP1-01", type: "weakness", situation: "", gap: "", evidence: [], expectationIds: [], absenceClaim: null, claimsExecution: false, ...o });

test("[real excerpt] 구조화된 expectationIds 를 신뢰하되 환각 ID 는 버린다", () => {
  const a = assessmentFromVerdict(
    verdictWith([
      F({ id: "S", type: "strength", situation: "ID 자동 부여가 정의됨", expectationIds: ["SUP.10.BP1.E2"] }),
      F({ id: "H", type: "strength", situation: "임의 서술", expectationIds: ["SUP.10.BP9.E7"] }),
    ]),
    { artifacts: [{ name: "plan.docx", text }], engines: ["llm"] },
  );
  assert.deepEqual(a.findings.find((f) => f.findingId === "S").expectationIds, ["SUP.10.BP1.E2"]);
  assert.deepEqual(a.findings.find((f) => f.findingId === "H").expectationIds, [], "존재하지 않는 기대사항 ID 는 버린다");
  assert.deepEqual(validateAssessment(a).violations, []);
});

test("[real excerpt] 구조화된 absenceClaim: 사전 개념(개시자)의 반대 증거가 있으면 보류하고 근거를 인용한다", () => {
  const a = assessmentFromVerdict(
    verdictWith([F({ id: "W", situation: "변경 요청 개시자가 기록되지 않는다", gap: "개시자 부재", absenceClaim: { target: "개시자", alternativeTerms: ["요청자"] } })]),
    { artifacts: [{ name: "plan.docx", text }], engines: ["llm"] },
  );
  const w = a.findings.find((f) => f.findingId === "W");
  assert.equal(w.disposition, "DEFERRED");
  assert.ok(w.evidenceIds.length > 0);
  assert.match(w.dispositionReason, /제안자/);
});

test("[synthetic] claimsExecution=true 인 서술은 계획 증거만 있으면 수정 처리한다", () => {
  const a = assessmentFromVerdict(
    verdictWith([F({ id: "E", type: "strength", situation: "Polarion 으로 양방향 추적이 자동으로 수행되고 있다", claimsExecution: true, evidence: [{ artifactName: "plan.docx", quote: "Polarion ALM의 Linked Items 기능으로 양방향 자동 추적", location: "§9.1" }] })]),
    { artifacts: [{ name: "plan.docx", text }], engines: ["llm"] },
  );
  const e = a.findings.find((f) => f.findingId === "E");
  assert.equal(e.disposition, "MODIFIED");
  assert.match(e.dispositionReason, /계획·선언 증거만/);
  assert.equal(a.promptVersion, BP_PROMPT_VERSION);
});

test("[real excerpt] 긴 서술형 absenceClaim 대상의 우연한 단어 일치(부여·종결)를 개념으로 오인하지 않는다 (실제 LLM 응답에서 관찰된 사례)", () => {
  const a = assessmentFromVerdict(
    verdictWith([F({ id: "W", situation: "자원 가용성 확인이 없다", gap: "가용성 판정 기준 부재", absenceClaim: { target: "분석 결과 및 자원 가용성을 우선순위 지정과 구현 승인 결정에 연결하는 판정 기준 및 기록 항목", alternativeTerms: ["resource availability", "release allocation"] } })]),
    { artifacts: [{ name: "plan.docx", text: text + " ID 자동 부여 | Polarion 자동" }], engines: ["llm"] },
  );
  const w = a.findings.find((f) => f.findingId === "W");
  assert.equal(w.disposition, "ACCEPTED", "관련 없는 '부여' 표현 때문에 유효한 약점이 보류되지 않는다");
});

test("프롬프트: 평가 범위를 명시한다 — 기본은 문서 적절성 검토(수행 기록 부재는 약점이 아님), 수행 평가는 별도 문구", () => {
  const bp = sup10.basePractices.find((b) => b.id === "BP4");
  const doc = buildBpPrompt({ process: sup10, bp, artifactsExcerpt: "x", projectFingerprint: "" }).task;
  assert.match(doc, /# 평가 범위: 문서 적절성 검토/);
  assert.match(doc, /실제 프로세스 수행\(Capability Level 달성\)을 판정하지 않는다/);
  assert.match(doc, /제출되지 않았다는 사실은 약점이 아니다/);
  assert.match(doc, /type "observation"/);
  assert.match(doc, /목차·BP 매핑표·자기충족 선언은 본문 근거가 아니다/);
  const perf = buildBpPrompt({ process: sup10, bp, artifactsExcerpt: "x", projectFingerprint: "", assessmentScope: "PROCESS_PERFORMANCE" }).task;
  assert.match(perf, /# 평가 범위: 프로세스 수행 평가/);
  assert.doesNotMatch(perf, /제출되지 않았다는 사실은 약점이 아니다/);
  assert.equal(BP_PROMPT_VERSION, "bp-prompt/2.1.0");
});

test("[real LLM 응답에서 관찰] expectationIds 를 빈 배열로 명시한 약점은 후보 매핑으로 다른 기대사항에 붙이지 않는다", () => {
  const claim = "본문은 상태 배정을 충족하도록 정의하지만 계획서의 BP 매핑표는 BP 번호를 공식 BP 와 다르게 표기한다";
  const verdict = verdictWith([
    F({ id: "S", type: "strength", situation: "초기 상태 Submitted 배정과 7개 상태 전이가 정의됨", expectationIds: ["SUP.10.BP1.E3"], expectationIdsDeclared: true }),
    F({ id: "W", type: "weakness", situation: claim, gap: "문서 BP 번호 표기 불일치", expectationIds: [], expectationIdsDeclared: true }),
  ]);
  const a = assessmentFromVerdict(verdict, { artifacts: [{ name: "plan.docx", text }], engines: ["llm"] });
  assert.deepEqual(a.findings.find((f) => f.findingId === "W").expectationIds, []);
  assert.equal(a.findings.find((f) => f.findingId === "S").disposition, "ACCEPTED", "무관한 약점 때문에 근거 있는 강점이 보류되지 않는다");
  // 필드를 아예 보내지 않은(declared 아님) 레거시 응답은 기존처럼 후보 매핑을 쓴다
  const legacy = assessmentFromVerdict(verdictWith([{ id: "L", type: "strength", situation: "변경 요청의 구현이 관련 이해관계자에 의해 종료 전에 확인된다", gap: "", evidence: [] }]), { artifacts: [{ name: "plan.docx", text }], engines: ["llm"] });
  assert.ok(legacy.findings[0].expectationIds.length <= 1);
});
