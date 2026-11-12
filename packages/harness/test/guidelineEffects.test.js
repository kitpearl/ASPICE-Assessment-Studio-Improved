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
  assert.ok(r.gaps[0].endsWith("(" + "x".repeat(80) + "…)"));
  const low = applyAppliedRules({ scorePercent: 10, gaps: [], appliedRules: [{ ruleId: "M", applied: true, note: "" }] }, rules);
  assert.equal(low.scorePercent, 10);
  assert.equal(low.appliedRules[0].capped, undefined);
});

test("applyAppliedRules: crossProcess rule applied by LLM never caps", () => {
  const rules = new Map([["MAN.3.RL.17", {
    id: "MAN.3.RL.17",
    effect: { kind: "cap", maxRating: "P" },
    condition: { kind: "rating", source: { kind: "bp", process: "SUP.10", id: "BP2" }, when: ["N", "P"], crossProcess: true },
    text: "x",
  }]]);
  const r = applyAppliedRules({ scorePercent: 90, gaps: [], appliedRules: [{ ruleId: "MAN.3.RL.17", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 90);
  assert.deepEqual(r.gaps, []);
  assert.equal(r.appliedRules.length, 1);
  assert.equal(r.appliedRules[0].capped, undefined);
});

test("applyAppliedRules: rating-condition rule without reasonQualified is left to the rule engine", () => {
  const rules = new Map([["R", {
    id: "R",
    effect: { kind: "cap", maxRating: "N" },
    condition: { kind: "rating", source: { kind: "bp", id: "BP2" }, when: ["N"] },
    text: "x",
  }]]);
  const r = applyAppliedRules({ scorePercent: 90, gaps: [], appliedRules: [{ ruleId: "R", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 90);
  assert.deepEqual(r.gaps, []);
  assert.equal(r.appliedRules[0].capped, undefined);
});

test("applyAppliedRules: reason-qualified rating-condition rule may still be applied by the LLM", () => {
  const rules = new Map([["Q", {
    id: "Q",
    effect: { kind: "must-downrate" },
    condition: { kind: "rating", source: { kind: "bp", id: "BP2" }, when: ["N", "P"], reasonQualified: true },
    text: "x",
  }]]);
  const r = applyAppliedRules({ scorePercent: 95, gaps: [], appliedRules: [{ ruleId: "Q", applied: true, note: "" }] }, rules);
  assert.equal(r.scorePercent, 85);
  assert.equal(r.appliedRules[0].capped, true);
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
