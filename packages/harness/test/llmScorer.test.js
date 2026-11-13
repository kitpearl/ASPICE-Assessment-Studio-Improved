import { test } from "node:test";
import assert from "node:assert/strict";
import { createLlmScorer } from "../src/evaluators/llmScorer.js";
import { loadProcess } from "../spec/canonical/index.js";

const stubClient = (parsed) => ({ generateJson: async () => ({ parsed }) });

test("llmScorer applies cap from applied rule and returns references", async () => {
  const client = { generateJson: async () => ({ parsed: { scorePercent: 40, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "consistent", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.4", applied: true, note: "기능/비기능만 분류" }] } }) };
  const scorer = createLlmScorer({ client });
  const r = await scorer.scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [{ name: "a.md", text: "요구사항" }] });
  assert.equal(r.scorePercent, 15);
  assert.equal(r.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP2");
  assert.equal(r.appliedRules[0].capped, true);
});

test("llmScorer drops unknown rule ids without rejecting", async () => {
  const client = stubClient({ scorePercent: 80, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "consistent", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.99", applied: true }] });
  const scorer = createLlmScorer({ client });
  const r = await scorer.scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.equal(r.scorePercent, 80);
  assert.deepEqual(r.appliedRules, []);
});

test("llmScorer only accepts rule ids from the item's knowledge", async () => {
  // SWE.2 rule exists globally but is not in SWE.1.BP2 knowledge → dropped.
  const client = stubClient({ scorePercent: 80, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", guidelineCitations: [{ ruleId: "SWE.2.RL.1", applied: true }] });
  const r = await createLlmScorer({ client }).scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.deepEqual(r.appliedRules, []);
});

test("llmScorer applies cap after context multiplier", async () => {
  // must-downrate (L, 85) rule: 88 * 0.95 (partial) = 84 → not above cap, no gap from rule.
  const client = stubClient({ scorePercent: 88, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "partial", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.6", applied: true }] });
  const r = await createLlmScorer({ client }).scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.equal(r.scorePercent, 84);
  assert.notEqual(r.appliedRules[0].capped, true);
});

test("llmScorer uses injected knowledge and keeps references on rejection", async () => {
  const knowledge = {
    getBpKnowledge: () => ({ process: { id: "X", name: "x", purpose: "", outcomes: [] }, bp: { id: "BP1", title: "t", notes: [] }, outputWorkProducts: [], guideline: { rules: [], notes: [] }, references: { pam: { citation: "PAM 4.1 §9.9.9 X.BP1" }, guideline: [] } }),
  };
  const client = stubClient({ scorePercent: 50, evidence: [], gaps: [] });
  const r = await createLlmScorer({ client, knowledge }).scoreBP({ process: { id: "X", name: "x", pamSection: "9.9.9" }, bp: { id: "BP1", title: "t" }, artifacts: [] });
  assert.equal(r.scorePercent, 0);
  assert.ok(r.gaps.some((g) => /rejected/.test(g)));
  assert.equal(r.references.pam.citation, "PAM 4.1 §9.9.9 X.BP1");
});

test("llmScorer without knowledge omits references", async () => {
  const knowledge = { getBpKnowledge: () => null };
  const client = stubClient({ scorePercent: 60, evidence: [], gaps: [], pamCitation: "PAM §4.4.1 BP2" });
  const r = await createLlmScorer({ client, knowledge }).scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.equal(r.scorePercent, 60);
  assert.equal(r.references, undefined);
});

test("llmScorer holds an N-cap rule when the LLM's own score contradicts it (80% + cap:N)", async () => {
  const client = stubClient({ scorePercent: 80, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "consistent", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.4", applied: true, note: "분류 기준 일부 부족" }] });
  const r = await createLlmScorer({ client }).scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.equal(r.scorePercent, 80);
  assert.equal(r.appliedRules[0].applied, false);
  assert.equal(r.appliedRules[0].capped, undefined);
  assert.match(r.appliedRules[0].note, /^\[보류: LLM 점수 80% 와 불일치\]/);
  assert.ok(!r.gaps.some((g) => /가이드라인 \[/.test(g)));
});

test("llmScorer holds an applied rule without a note", async () => {
  const client = stubClient({ scorePercent: 40, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP2", contextConsistency: { status: "consistent", note: "" }, guidelineCitations: [{ ruleId: "SWE.1.RL.4", applied: true, note: "  " }] });
  const r = await createLlmScorer({ client }).scoreBP({ process: loadProcess("SWE.1"), bp: loadProcess("SWE.1").basePractices[1], artifacts: [] });
  assert.equal(r.scorePercent, 40);
  assert.equal(r.appliedRules[0].applied, false);
  assert.match(r.appliedRules[0].note, /^\[보류: 근거 없음\]/);
});
