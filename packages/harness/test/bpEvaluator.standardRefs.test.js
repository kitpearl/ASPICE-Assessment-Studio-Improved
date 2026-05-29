import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateBPs } from "../src/evaluators/bpEvaluator.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { loadProcess } from "../spec/canonical/index.js";
import { _clearStandardRefsCache } from "../spec/standardRefs.js";

test("evaluateBPs: BPResult.standardReferences merges scorer refs + CSV refs", async () => {
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
  // ruleScorer populated pam[]; CSV ingest populated bgbRL/iso for SYS.2.BP5.
  assert.ok(bp5.standardReferences.pam.length >= 1, "PAM citation from scorer should be present");
  assert.ok(bp5.standardReferences.bgbRL.includes("RL3"));
  assert.ok(bp5.standardReferences.iso.includes("ISO/IEC 33020:2019 §5.3"));
});

test("evaluateBPs: each finding inherits the CSV-derived refs too", async () => {
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
  assert.ok(f.standardReferences.bgbRL.includes("RL3"));
  assert.ok(f.standardReferences.iso.includes("ISO/IEC 33020:2019 §5.3"));
});

test("evaluateBPs: BP without CSV mapping shows no BGB/ISO refs (graceful)", async () => {
  _clearStandardRefsCache();
  const sys2 = loadProcess("SYS.2");
  // BP1 of SYS.2 is not in the demo CSV.
  const results = await evaluateBPs(sys2, [{ name: "x.md", text: "unrelated" }], ruleScorer);
  const bp1 = results.find((r) => r.id === "BP1");
  assert.ok(bp1, "expected SYS.2.BP1 in results");
  assert.deepEqual(bp1.standardReferences.bgbRL, []);
  assert.deepEqual(bp1.standardReferences.iso, []);
});
