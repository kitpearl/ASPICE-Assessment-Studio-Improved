import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATING_CAP_PERCENT,
  capForEffect,
  applyAppliedRules,
  normalizeGuidelineCitations,
} from "../src/evaluators/guidelineEffects.js";

test("capForEffect", () => {
  assert.deepEqual(RATING_CAP_PERCENT, { N: 15, P: 50, L: 85 });
  assert.equal(capForEffect({ kind: "cap", maxRating: "N" }), 15);
  assert.equal(capForEffect({ kind: "must-downrate" }), 85);
  assert.equal(capForEffect({ kind: "cap-source" }, 40), 40);
  assert.equal(capForEffect({ kind: "must-not-downrate" }), null);
});

test("applyAppliedRules caps score and annotates gap", () => {
  const rules = new Map([["SWE.1.RL.4", { id: "SWE.1.RL.4", effect: { kind: "cap", maxRating: "N" }, text: "..." }]]);
  const r = applyAppliedRules({ scorePercent: 70, gaps: [], appliedRules: [{ ruleId: "SWE.1.RL.4", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 15);
  assert.match(r.gaps[0], /^가이드라인 \[SWE\.1\.RL\.4\] 적용: 상한 N/);
  assert.equal(r.appliedRules[0].capped, true);
});

test("applyAppliedRules ignores not-applied, must-not-downrate, cap-source, unknown", () => {
  const rules = new Map([
    ["A", { id: "A", effect: { kind: "cap", maxRating: "N" }, text: "" }],
    ["B", { id: "B", effect: { kind: "must-not-downrate" }, text: "" }],
    ["C", { id: "C", effect: { kind: "cap-source" }, text: "" }],
  ]);
  const r = applyAppliedRules({
    scorePercent: 70,
    gaps: [],
    appliedRules: [
      { ruleId: "A", applied: false, note: "" },
      { ruleId: "B", applied: true, note: "" },
      { ruleId: "C", applied: true, note: "" },
      { ruleId: "Z", applied: true, note: "" },
    ],
  }, rules);
  assert.equal(r.scorePercent, 70);
  assert.deepEqual(r.gaps, []);
});

test("applyAppliedRules must-downrate labels L and does not raise low scores", () => {
  const rules = new Map([["M", { id: "M", effect: { kind: "must-downrate" }, text: "x".repeat(100) }]]);
  const r = applyAppliedRules({ scorePercent: 95, gaps: [], appliedRules: [{ ruleId: "M", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 85);
  assert.match(r.gaps[0], /상한 L/);
  assert.ok(r.gaps[0].endsWith("(" + "x".repeat(60) + ")"));
  const low = applyAppliedRules({ scorePercent: 10, gaps: [], appliedRules: [{ ruleId: "M", applied: true, note: "" }] }, rules);
  assert.equal(low.scorePercent, 10);
  assert.equal(low.appliedRules[0].capped, undefined);
});

test("normalizeGuidelineCitations drops unknown ids and dedupes", () => {
  const out = normalizeGuidelineCitations(
    [{ ruleId: "SWE.1.RL.4", applied: true }, { ruleId: "SWE.1.RL.99", applied: true }, "junk", { ruleId: "SWE.1.RL.4", applied: false }],
    new Set(["SWE.1.RL.4"]),
  );
  assert.deepEqual(out, [{ ruleId: "SWE.1.RL.4", applied: true, note: "" }]);
  assert.deepEqual(normalizeGuidelineCitations("x", new Set(["a"])), []);
  assert.deepEqual(normalizeGuidelineCitations([{ ruleId: "a", applied: "true", note: 5 }], new Set(["a"])), [{ ruleId: "a", applied: false, note: "" }]);
});
