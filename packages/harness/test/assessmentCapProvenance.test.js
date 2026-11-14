// 깎이기 전 점수 기록: 검증되지 않은 LLM 규칙 주장으로 점수가 깎인 경우 원래 값을 보존하고 구조화 평가에서 복원한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcess } from "../spec/canonical/index.js";
import { createLlmScorer } from "../src/evaluators/llmScorer.js";
import { createHybridScorer } from "../src/evaluators/hybridScorer.js";
import { evaluateBPs } from "../src/evaluators/bpEvaluator.js";
import { assessmentFromVerdict } from "../src/assessment/fromVerdict.js";
import { validateAssessment } from "../src/assessment/invariants.js";
import { deriveSummary } from "../src/assessment/summary.js";

const sup10 = loadProcess("SUP.10");
const bp6 = sup10.basePractices.find((b) => b.id === "BP6");
const llmReply = (score) => ({
  scorePercent: score, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.8.4 SUP.10.BP6", contextConsistency: { status: "consistent", note: "" },
  guidelineCitations: [{ ruleId: "SUP.10.RL.10", applied: true, note: "개시자가 종결을 승인하지 않는다" }],
});

test("[real rule SUP.10.RL.10] LLM 스코어러: 상한으로 깎인 항목에 깎이기 전 점수를 남기고 결과로 돌려준다", async () => {
  const scorer = createLlmScorer({ client: { generateJson: async () => ({ parsed: llmReply(96) }) } });
  const r = await scorer.scoreBP({ process: sup10, bp: bp6, artifacts: [{ name: "a.md", text: "x" }] });
  assert.equal(r.scorePercent, 85, "must-downrate 는 기존 동작대로 L 상한 85");
  assert.equal(r.appliedRules[0].capped, true);
  assert.equal(r.appliedRules[0].scoreBefore, 96);
  assert.equal(r.scoreBeforeGuidelineCaps, 96);
  // 깎이지 않았다면 필드를 만들지 않는다
  const lowScorer = createLlmScorer({ client: { generateJson: async () => ({ parsed: llmReply(70) }) } });
  const low = await lowScorer.scoreBP({ process: sup10, bp: bp6, artifacts: [] });
  assert.equal(low.scoreBeforeGuidelineCaps, undefined);
});

test("[real rule SUP.10.RL.10] Hybrid: 융합 점수 기준의 깎이기 전 점수를 돌려준다", async () => {
  const llm = createLlmScorer({ client: { generateJson: async () => ({ parsed: llmReply(96) }) } });
  const rule = { scoreBP: async () => ({ scorePercent: 90, evidence: [], gaps: [], findings: [], standardReferences: { pam: [], pamNote: [], bgbRL: [], iso: [] } }) };
  const r = await createHybridScorer({ rule, llm }).scoreBP({ process: sup10, bp: bp6, artifacts: [{ name: "a.md", text: "x" }] });
  // 깎이기 전 융합 = 0.4×90 + 0.6×96 = 93.6 → 94. 깎인 뒤: LLM 85 로 융합하면 87 이지만 융합 점수에도 상한(85)이 다시 적용된다.
  assert.equal(r.scoreBeforeGuidelineCaps, 94);
  assert.equal(r.scorePercent, 85);
});

test("BPResult 로 전달된다(bpEvaluator)", async () => {
  const scorer = { scoreBP: async () => ({ scorePercent: 85, evidence: [], gaps: [], findings: [], appliedRules: [{ ruleId: "SUP.10.RL.10", applied: true, capped: true, note: "x", scoreBefore: 96 }], scoreBeforeGuidelineCaps: 96 }) };
  const [res] = await evaluateBPs({ ...sup10, basePractices: [bp6] }, [], scorer, {});
  assert.equal(res.scoreBeforeGuidelineCaps, 96);
});

const verdict = (extra = {}) => ({
  processId: "SUP.10",
  bps: [{ id: "BP6", title: "t", rating: "L+", scorePercent: 85, evidence: [], gaps: [], findings: [], appliedRules: [{ ruleId: "SUP.10.RL.10", applied: true, capped: true, note: "개시자 승인 부재", scoreBefore: 96 }], scoreBeforeGuidelineCaps: 96, ...extra }],
});

test("구조화 평가: 검증되지 않은 LLM 규칙 상한은 깎이기 전 등급을 임시 등급으로 쓰고 규칙은 검토 대기로 둔다", () => {
  const a = assessmentFromVerdict(verdict(), { artifacts: [{ name: "plan.docx", text: "x" }], engines: ["llm"] });
  const bp = a.bpResults.find((b) => b.bpId === "SUP.10.BP6");
  assert.equal(bp.provisionalRating, "F", "96% → F (깎이기 전)");
  assert.equal(bp.rating.value, "F");
  const rl10 = a.ruleEvaluations.find((r) => r.ruleId === "SUP.10.RL.10");
  assert.equal(rl10.conditionResult, "UNKNOWN");
  assert.equal(rl10.applicationStatus, "PENDING_REVIEW");
  assert.match(bp.rating.rationale, /96% → 85%|85% 로 낮췄다/);
  assert.ok(bp.rating.unresolvedIssues.some((u) => u.includes("SUP.10.RL.10")));
  assert.deepEqual(validateAssessment(a).violations, []);
  const row = deriveSummary(a).bpRows.find((r) => r.bpId === "SUP.10.BP6");
  assert.equal(row.rating, "F");
  assert.ok(row.unresolvedIssues.length > 0, "등급 옆에 미해결 규칙이 함께 표시된다");
});

test("깎인 것이 결정적 규칙 엔진 적용이거나 필드가 없으면(레거시 결과) 기존 등급을 그대로 쓴다", () => {
  const eng = verdict({ appliedRules: [{ ruleId: "SUP.10.RL.5", applied: true, capped: true, source: "rule-engine", note: "BP2 P" }] });
  assert.equal(assessmentFromVerdict(eng, { artifacts: [{ name: "p", text: "x" }], engines: ["llm"] }).bpResults.find((b) => b.bpId === "SUP.10.BP6").provisionalRating, "L");
  const legacy = verdict();
  delete legacy.bps[0].scoreBeforeGuidelineCaps;
  assert.equal(assessmentFromVerdict(legacy, { artifacts: [{ name: "p", text: "x" }], engines: ["llm"] }).bpResults.find((b) => b.bpId === "SUP.10.BP6").provisionalRating, "L");
});
