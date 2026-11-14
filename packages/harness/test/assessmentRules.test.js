// 조건부 규칙 처리 회귀 테스트 (외부 LLM 호출 없음, 결정적).
// 각 테스트의 "근거"는 가이드라인 2026 규칙 원문(canonical/guideline.json textEn)이다. 현재 출력에 맞추지 않았다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcess, loadProcesses, loadGuideline } from "../spec/canonical/index.js";
import { evaluateRules, classifyEffect } from "../src/assessment/ruleEngine.js";
import { validateAssessment } from "../src/assessment/invariants.js";
import { buildAssessment } from "../src/assessment/buildAssessment.js";

const rules = loadGuideline().rules;
const sup10 = loadProcess("SUP.10");
const P = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`SUP.10.${k}`, v]));
const run = (provisional, conditionInputs = {}, extra = {}) => evaluateRules({ processSpec: sup10, rules, provisional: P(provisional), conditionInputs, ...extra });
const ev = (r, id) => r.ruleEvaluations.find((e) => e.ruleId === id);

test("[real rule SUP.10.RL.3] T05 관련자가 모두 대표되면 RL.3 하향 조건은 FALSE → F 유지", () => {
  // 근거: RL.3 은 "모든 관련 분야가 대표되지 않는다면" F 불가. 대표되면 조건 불성립.
  const r = run({ BP3: "F" }, { "SUP.10.RL.3": { result: "FALSE", evidenceIds: ["EV-1"] } });
  assert.equal(ev(r, "SUP.10.RL.3").conditionResult, "FALSE");
  assert.equal(ev(r, "SUP.10.RL.3").applicationStatus, "NOT_TRIGGERED");
  assert.equal(r.ratings["SUP.10.BP3"].value, "F");
});

test("[real rule SUP.10.RL.3] T06 필수 관련자 누락이 입증되면 F 를 제외한다(EXCLUDE_F)", () => {
  const r = run({ BP3: "F" }, { "SUP.10.RL.3": { result: "TRUE", evidenceIds: ["EV-1"] } });
  const e = ev(r, "SUP.10.RL.3");
  assert.equal(e.effectType, "EXCLUDE_F");
  assert.equal(e.applicationStatus, "APPLIED");
  assert.equal(e.beforeRating, "F");
  assert.equal(e.afterRating, "L");
  assert.equal(r.ratings["SUP.10.BP3"].value, "L");
});

test("[real rule SUP.10.RL.3] T07 대표 여부가 불명확하면 UNKNOWN 유지 — 등급 불변, 검토 대기", () => {
  const r = run({ BP3: "F" });
  const e = ev(r, "SUP.10.RL.3");
  assert.equal(e.conditionResult, "UNKNOWN");
  assert.equal(e.applicationStatus, "PENDING_REVIEW");
  assert.equal(r.ratings["SUP.10.BP3"].value, "F");
  assert.ok(r.ratings["SUP.10.BP3"].pendingRuleIds.includes("SUP.10.RL.3"));
  assert.equal(r.needsReview, true);
});

test("[real rule SUP.10.RL.5] T09 BP2 가 L 이면 RL.5 의 P/N 선행조건을 충족하지 않는다", () => {
  for (const bp2 of ["L", "L+", "L-", "F"]) {
    const r = run({ BP2: bp2, BP3: "F" });
    assert.equal(ev(r, "SUP.10.RL.5").conditionResult, "FALSE", bp2);
    assert.equal(r.ratings["SUP.10.BP3"].value, "F", bp2);
  }
});

test("[real rule SUP.10.RL.5] T10 BP2 가 P/N 이고 RL.5 조건이 성립하면 BP3 는 BP2 보다 높을 수 없다", () => {
  const r = run({ BP2: "P-", BP3: "F" });
  const e = ev(r, "SUP.10.RL.5");
  assert.equal(e.effectType, "NOT_HIGHER_THAN_SOURCE");
  assert.equal(e.conditionResult, "TRUE");
  assert.equal(e.applicationStatus, "APPLIED");
  assert.equal(r.ratings["SUP.10.BP3"].value, "P");
  const n = run({ BP2: "N", BP3: "L" });
  assert.equal(n.ratings["SUP.10.BP3"].value, "N");
});

test("[real rule SUP.10.RL.6] T11 BP4 가 P/N 이어도 사유(의존성 누락)가 입증되지 않으면 BP2 로 전파하지 않는다", () => {
  // 근거: RL.6 은 "…CR 과 영향 작업 산출물 간 의존성 누락 때문에" 하향된 경우만.
  const other = run({ BP2: "L", BP4: "P" }, { "SUP.10.RL.6": { reasonResult: "FALSE" } });
  assert.equal(ev(other, "SUP.10.RL.6").applicationStatus, "NOT_TRIGGERED");
  const unknown = run({ BP2: "L", BP4: "P" });
  assert.equal(ev(unknown, "SUP.10.RL.6").conditionResult, "UNKNOWN");
  assert.equal(ev(unknown, "SUP.10.RL.6").applicationStatus, "PENDING_REVIEW");
  const l = run({ BP2: "L", BP4: "L" }, { "SUP.10.RL.6": { reasonResult: "TRUE" } });
  assert.equal(ev(l, "SUP.10.RL.6").conditionResult, "FALSE", "BP4 가 L 이면 사유와 무관하게 불성립");
  // 사유가 TRUE 여도 감점 폭은 임의로 정하지 않는다.
  const t = run({ BP2: "L", BP4: "P" }, { "SUP.10.RL.6": { reasonResult: "TRUE" } });
  assert.equal(ev(t, "SUP.10.RL.6").conditionResult, "TRUE");
  assert.equal(ev(t, "SUP.10.RL.6").applicationStatus, "PENDING_REVIEW");
  assert.equal(t.ratings["SUP.10.BP2"].value, "L");
});

test("[real rule SUP.10.RL.10] T12 개시자 승인 부족과 프로젝트 중요성 조건을 함께 확인한다", () => {
  const base = { result: "TRUE", evidenceIds: ["EV-1"] };
  const sigUnknown = run({ BP6: "F" }, { "SUP.10.RL.10": base });
  assert.equal(ev(sigUnknown, "SUP.10.RL.10").significanceConditionResult, "UNKNOWN");
  assert.equal(ev(sigUnknown, "SUP.10.RL.10").conditionResult, "UNKNOWN");
  assert.equal(ev(sigUnknown, "SUP.10.RL.10").applicationStatus, "PENDING_REVIEW");
  const sigFalse = run({ BP6: "F" }, { "SUP.10.RL.10": { ...base, significanceResult: "FALSE" } });
  assert.equal(ev(sigFalse, "SUP.10.RL.10").applicationStatus, "NOT_TRIGGERED");
  const both = run({ BP6: "F" }, { "SUP.10.RL.10": { ...base, significanceResult: "TRUE" } });
  assert.equal(ev(both, "SUP.10.RL.10").conditionResult, "TRUE");
  assert.equal(ev(both, "SUP.10.RL.10").applicationStatus, "PENDING_REVIEW", "폭 결정 없이는 하향하지 않는다");
  const decided = run({ BP6: "F" }, { "SUP.10.RL.10": { ...base, significanceResult: "TRUE" } }, { reviewerDecisions: { "SUP.10.RL.10": { downrateSteps: 1 } } });
  assert.equal(decided.ratings["SUP.10.BP6"].value, "L");
});

test("[real rule TAC.RL.1~3] T13 TAC 규칙은 무조건적인 F 보장이나 하향 금지로 쓰지 않는다", () => {
  assert.equal(classifyEffect(rules.find((r) => r.id === "TAC.RL.1")).type, "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON");
  const unknown = run({ BP4: "L" });
  for (const id of ["TAC.RL.1", "TAC.RL.2", "TAC.RL.3"]) assert.equal(ev(unknown, id).applicationStatus, "PENDING_REVIEW");
  const t = run({ BP4: "L" }, { "TAC.RL.1": { result: "TRUE", evidenceIds: ["EV-1"], reasonKey: "cluster-level-trace" } });
  const e = ev(t, "TAC.RL.1");
  assert.equal(e.applicationStatus, "CONSTRAINT_RECORDED");
  assert.equal(e.afterRating, e.beforeRating);
  assert.equal(t.ratings["SUP.10.BP4"].value, "L", "등급을 올리지 않는다(L → F 아님)");
  assert.equal(e.reasonKey, "cluster-level-trace");
});

test("[synthetic] 하향 금지는 같은 사유의 하향 필수와 양립 불가 → 임의 등급 없이 검토 필요", () => {
  const spec = { id: "X.1", basePractices: [{ id: "BP1" }] };
  const rs = [
    { id: "X.1.RL.1", scope: { kind: "process", id: "X.1" }, targets: [{ kind: "bp", process: "X.1", id: "BP1" }], effect: { kind: "must-not-downrate" }, condition: { kind: "evidence" }, textEn: "If A, BP1 shall not be downrated." },
    { id: "X.1.RL.2", scope: { kind: "process", id: "X.1" }, targets: [{ kind: "bp", process: "X.1", id: "BP1" }], effect: { kind: "must-downrate" }, condition: { kind: "evidence" }, textEn: "If B, BP1 shall be downrated." },
  ];
  const r = evaluateRules({
    processSpec: spec, rules: rs, provisional: { "X.1.BP1": "L" },
    conditionInputs: { "X.1.RL.1": { result: "TRUE", reasonKey: "R" }, "X.1.RL.2": { result: "TRUE" } },
    reviewerDecisions: { "X.1.RL.2": { downrateSteps: 1, reasonKey: "R" } },
  });
  assert.ok(r.conflicts.some((c) => c.kind === "IMPOSSIBLE_CONSTRAINT"));
  assert.equal(r.ratings["X.1.BP1"].status, "WITHHELD");
  assert.equal(r.ratings["X.1.BP1"].value, null);
});

test("[synthetic] 순환 등급 의존성은 임의로 풀지 않고 WITHHELD", () => {
  const spec = { id: "Y.1", basePractices: [{ id: "BP1" }, { id: "BP2" }] };
  const mk = (id, src, tgt) => ({ id, scope: { kind: "process", id: "Y.1" }, targets: [{ kind: "bp", process: "Y.1", id: tgt }], effect: { kind: "cap-source" }, condition: { kind: "rating", source: { kind: "bp", process: "Y.1", id: src }, when: ["N", "P"] }, textEn: `If ${src} is rated P or N, ${tgt} shall not be rated higher.` });
  const r = evaluateRules({ processSpec: spec, rules: [mk("Y.RL.1", "BP1", "BP2"), mk("Y.RL.2", "BP2", "BP1")], provisional: { "Y.1.BP1": "P", "Y.1.BP2": "P" } });
  assert.ok(r.conflicts.some((c) => c.kind === "CIRCULAR_RULE_DEPENDENCY"));
  assert.equal(r.ratings["Y.1.BP1"].status, "WITHHELD");
});

test("[real rule SUP.10.RL.10] T25 같은 규칙을 반복 적용해도 추가 감점이 누적되지 않는다", () => {
  const inputs = { "SUP.10.RL.10": { result: "TRUE", significanceResult: "TRUE", evidenceIds: ["EV-1"] } };
  const dec = { "SUP.10.RL.10": { downrateSteps: 1 } };
  const first = run({ BP6: "F" }, inputs, { reviewerDecisions: dec });
  assert.equal(first.ratings["SUP.10.BP6"].value, "L");
  // 결과를 다시 입력(임시 등급=L)으로 넣고 이전 평가 기록을 함께 주면 같은 결과.
  const second = run({ BP6: first.ratings["SUP.10.BP6"].value }, inputs, { reviewerDecisions: dec, priorEvaluations: first.ruleEvaluations });
  assert.equal(second.ratings["SUP.10.BP6"].value, "L");
  assert.equal(ev(second, "SUP.10.RL.10").beforeRating, "F");
  assert.deepEqual(run({ BP6: "F" }, inputs, { reviewerDecisions: dec }).ratings, first.ratings);
});

test("[real rule] 규칙 효과 분류: 가이드라인 전체 규칙이 정의된 효과 유형으로 분류된다", () => {
  const types = new Set(["EXCLUDE_F", "CAP_AT_RATING", "DOWNRATE_REQUIRED", "NOT_HIGHER_THAN_SOURCE", "PROHIBIT_DOWNRATE_FOR_SPECIFIC_REASON", "MANUAL_REVIEW"]);
  for (const r of rules) assert.ok(types.has(classifyEffect(r).type), r.id);
  assert.equal(classifyEffect(rules.find((r) => r.id === "SUP.10.RL.1")).type, "EXCLUDE_F");
  assert.equal(classifyEffect(rules.find((r) => r.id === "SUP.10.RL.2")).type, "DOWNRATE_REQUIRED");
  assert.equal(classifyEffect(rules.find((r) => r.id === "SUP.10.RL.5")).type, "NOT_HIGHER_THAN_SOURCE");
});

// ── 전체 프로세스 일반화 ────────────────────────────────────────────────────
test("[generalization] 모든 프로세스: 조건 UNKNOWN/FALSE 규칙은 어떤 등급도 바꾸지 않는다", () => {
  for (const proc of loadProcesses()) {
    const prov = Object.fromEntries(proc.basePractices.map((b) => [`${proc.id}.${b.id}`, "F"]));
    const r = evaluateRules({ processSpec: proc, rules, provisional: prov });
    for (const e of r.ruleEvaluations) {
      if (e.conditionResult === "UNKNOWN") assert.ok(["PENDING_REVIEW", "NOT_EVALUATED"].includes(e.applicationStatus), `${proc.id} ${e.ruleId}`);
      if (e.conditionResult !== "TRUE") assert.notEqual(e.applicationStatus, "APPLIED", `${proc.id} ${e.ruleId}`);
    }
    for (const k of Object.keys(prov)) assert.ok(r.ratings[k].value === "F" || r.ratings[k].value === null, `${proc.id} ${k}`);
  }
});

test("[generalization] 모든 프로세스: 빈 입력으로 구조화 평가를 만들고 스키마·불변조건을 통과한다", () => {
  for (const proc of loadProcesses()) {
    const a = buildAssessment({
      processSpec: proc,
      manifest: [{ documentId: "DOC-1", fileName: "plan.docx", contentHash: null, documentVersion: null, extractionStatus: "OK", unreadableRanges: [] }],
    });
    const v = validateAssessment(a);
    assert.deepEqual(v.schemaErrors, [], proc.id);
    assert.deepEqual(v.violations, [], proc.id);
    assert.equal(a.bpResults.length, proc.basePractices.length);
    // 임시 등급이 없으면 검색·증거 상태에서 등급을 자동 산출하지 않는다 (불충분한 증거 ≠ N)
    assert.ok(a.bpResults.every((b) => b.rating.status === "WITHHELD" && b.rating.value === null), proc.id);
  }
});
