import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateBPs } from "../src/evaluators/bpEvaluator.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { loadProcess } from "../spec/canonical/index.js";
import { _clearStandardRefsCache } from "../spec/standardRefs.js";

// After P5-bis the BGB index is auto-extracted from the VDA guideline. SYS.2.BP5
// happens to carry [SYS.2.RL.3] and [SYS.2.RL.10] there.
//
// ISO 근거는 BP 평가에서 제외한다 (요청): bpEvaluator 가 PAM·BGB 만 병합하고
// iso 는 항상 빈 배열이어야 한다 — scorer 나 spec/iso CSV 가 무엇을 담든 무관.

const RL_RE = /^\[[A-Z][A-Z0-9.]*\.RL\.(?:\d+|xx)\]$/;

test("evaluateBPs: BPResult.standardReferences merges scorer refs + spec refs", async () => {
  _clearStandardRefsCache();
  const sys2 = loadProcess("SYS.2");
  const artifacts = [
    {
      name: "Trace.xlsx",
      text:
        "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
    },
  ];
  const results = await evaluateBPs(sys2, artifacts, ruleScorer);
  const bp5 = results.find((r) => r.id === "BP5");
  assert.ok(bp5, "expected SYS.2.BP5 in results");
  assert.ok(bp5.standardReferences.pam.length >= 1, "PAM citation from scorer should be present");
  // BGB rules for SYS.2.BP5 are populated by extractBgbRules — exact set is
  // brittle, just check non-empty and well-formed.
  assert.ok(bp5.standardReferences.bgbRL.length > 0, "expected BGB rules for SYS.2.BP5");
  for (const rl of bp5.standardReferences.bgbRL) assert.match(rl, RL_RE);
  assert.deepEqual(bp5.standardReferences.iso, [], "ISO 근거는 BP 평가에서 제외");
});

test("evaluateBPs: each finding inherits the spec-derived refs too", async () => {
  _clearStandardRefsCache();
  const sys2 = loadProcess("SYS.2");
  const artifacts = [
    {
      name: "Trace.xlsx",
      text:
        "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
    },
  ];
  const results = await evaluateBPs(sys2, artifacts, ruleScorer);
  const bp5 = results.find((r) => r.id === "BP5");
  assert.ok(bp5.findings.length >= 1);
  const f = bp5.findings[0];
  assert.ok(f.standardReferences.bgbRL.length > 0, "finding should inherit BGB rules");
  for (const rl of f.standardReferences.bgbRL) assert.match(rl, RL_RE);
  assert.deepEqual(f.standardReferences.iso, [], "finding 도 ISO 근거를 갖지 않는다");
});

test("evaluateBPs: BP without spec mapping shows no BGB/ISO refs (graceful)", async () => {
  _clearStandardRefsCache();
  // PIM.3.BP3 is absent from both the extracted BGB CSV and the ISO CSV
  // (the source guideline does not specify a rule that names BP3 of PIM.3).
  const pim3 = loadProcess("PIM.3");
  const bp3Spec = pim3.basePractices.find((b) => b.id === "BP3");
  if (!bp3Spec) {
    // PIM.3 may not define BP3 in the canonical spec — fall back to a
    // synthetic BP that we know has no CSV row.
    const results = await evaluateBPs(pim3, [{ name: "x.md", text: "unrelated" }], ruleScorer);
    for (const r of results) {
      if (r.standardReferences.bgbRL.length === 0 && r.standardReferences.iso.length === 0) {
        return; // at least one BP in PIM.3 is unmapped — assertion holds
      }
    }
    assert.fail("expected at least one PIM.3 BP to have no BGB/ISO refs");
    return;
  }
  const results = await evaluateBPs(pim3, [{ name: "x.md", text: "unrelated" }], ruleScorer);
  const bp3 = results.find((r) => r.id === "BP3");
  assert.ok(bp3, "expected PIM.3.BP3 in results");
  assert.deepEqual(bp3.standardReferences.bgbRL, []);
  assert.deepEqual(bp3.standardReferences.iso, []);
});
