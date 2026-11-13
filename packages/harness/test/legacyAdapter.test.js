import { test } from "node:test";
import assert from "node:assert/strict";
import { toLegacyShape } from "../../../api/_legacyAdapter.js";

test("toLegacyShape passes references and prefixes basis", () => {
  const legacy = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "F", scorePercent: 90, evidence: [], gaps: [], pamCitation: "PAM 4.1 §4.4.1 SWE.1.BP1", references: { pam: { citation: "PAM 4.1 §4.4.1 SWE.1.BP1", page: 50 }, guideline: [] }, appliedRules: [] }], pas: [], capabilityLevel: 1, capabilityLevelReason: "ok" });
  assert.equal(legacy.ratings[0].references.pam.page, 50);
  assert.match(legacy.summary, /^기준: PAM 4\.1 · Guidelines 2026 · CL1/);
});

test("toLegacyShape defaults appliedRules to [] and tolerates missing references", () => {
  const legacy = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "N", scorePercent: 0, evidence: [], gaps: [] }], capabilityLevel: 0, capabilityLevelReason: "x" });
  assert.deepEqual(legacy.ratings[0].appliedRules, []);
  assert.equal(legacy.ratings[0].references, undefined);
  const withRules = toLegacyShape({ bps: [{ id: "BP1", title: "t", rating: "P-", scorePercent: 20, evidence: [], gaps: [], appliedRules: [{ ruleId: "SWE.1.RL.4", applied: true, note: "n" }] }], capabilityLevel: 0 });
  assert.equal(withRules.ratings[0].appliedRules[0].ruleId, "SWE.1.RL.4");
});
