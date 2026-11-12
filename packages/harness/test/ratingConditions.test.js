import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRatingConditionRules } from "../src/evaluators/ratingConditions.js";
import { loadGuideline } from "../spec/canonical/index.js";

const rules = loadGuideline().rules;

test("SUP.10: BP3 cannot exceed BP2 when BP2 is P", () => {
  const bps = [{ id: "BP2", scorePercent: 40, rating: "P+", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules: loadGuideline().rules });
  assert.equal(bps[1].scorePercent, 40);
  assert.equal(bps[1].rating, "P+");
  assert.ok(applied.some((a) => a.ruleId === "SUP.10.RL.5"));
  const entry = bps[1].appliedRules.find((e) => e.ruleId === "SUP.10.RL.5");
  assert.deepEqual(entry, { ruleId: "SUP.10.RL.5", applied: true, note: "BP2 P", source: "rule-engine", capped: true });
  assert.ok(bps[1].gaps.some((g) => g.startsWith("가이드라인 [SUP.10.RL.5] 적용: BP2가 P이므로 상한")));
});

test("no change when condition not met", () => {
  const bps = [{ id: "BP2", scorePercent: 70, rating: "L-", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  assert.equal(bps[1].scorePercent, 90);
  assert.equal(bps[1].rating, "F");
  assert.deepEqual(applied, []);
});

test("SUP.1: PA 1.1 capped at L when BP3 is N", () => {
  const pas = [{ paId: "PA 1.1", level: 1, rating: "F", collapsed: "F", gps: [{ id: "GP 1.1.1", scorePercent: 95, rating: "F", gaps: [] }] }];
  applyRatingConditionRules({ processId: "SUP.1", bps: [{ id: "BP3", scorePercent: 5, rating: "N", gaps: [] }], pas, rules });
  assert.equal(pas[0].collapsed, "L");
  assert.equal(pas[0].gps[0].scorePercent, 85);
});

test("cross-process rule never changes scores", () => {
  const bps = [{ id: "BP4", scorePercent: 90, rating: "F", gaps: [] }, { id: "BP5", scorePercent: 5, rating: "N", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "MAN.3", bps, pas: [], rules });
  assert.equal(bps[0].scorePercent, 90);
  assert.ok(!applied.some((a) => a.ruleId === "MAN.3.RL.17"));
});

test("GP-sourced rule caps the target GP and refreshes PA rating", () => {
  const pas = [
    {
      paId: "PA 2.2",
      level: 2,
      rating: "L+",
      collapsed: "L",
      gps: [
        { id: "GP 2.2.2", scorePercent: 30, rating: "P-", gaps: [] },
        { id: "GP 2.2.3", scorePercent: 100, rating: "F", gaps: [] },
      ],
    },
  ];
  const { applied } = applyRatingConditionRules({ processId: "SWE.1", bps: [], pas, rules });
  assert.ok(applied.some((a) => a.ruleId === "PA2.2.RL.7" && a.target === "GP 2.2.3"));
  assert.equal(pas[0].gps[1].scorePercent, 30);
  assert.equal(pas[0].collapsed, "P");
});

test("idempotent: second run applies nothing new", () => {
  const bps = [{ id: "BP2", scorePercent: 40, rating: "P+", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  const gapsBefore = bps[1].gaps.length;
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  assert.deepEqual(applied, []);
  assert.equal(bps[1].gaps.length, gapsBefore);
});

test("never raises a score already below the cap", () => {
  const pas = [{ paId: "PA 1.1", level: 1, rating: "P+", collapsed: "P", gps: [{ id: "GP 1.1.1", scorePercent: 40, rating: "P+", gaps: [] }] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.1", bps: [{ id: "BP3", scorePercent: 5, rating: "N", gaps: [] }], pas, rules });
  assert.equal(pas[0].gps[0].scorePercent, 40);
  assert.deepEqual(applied, []);
});
