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
  // the GP holding the gap also carries the rule-engine entry so its chip shows "applied"
  assert.ok(pas[0].gps[0].appliedRules.some((e) => /^SUP\.1\.RL\./.test(e.ruleId) && e.source === "rule-engine" && e.capped === true));
});

test("cross-process rule never changes scores", () => {
  const bps = [{ id: "BP4", scorePercent: 90, rating: "F", gaps: [] }, { id: "BP5", scorePercent: 5, rating: "N", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "MAN.3", bps, pas: [], rules });
  assert.equal(bps[0].scorePercent, 90);
  assert.ok(!applied.some((a) => a.ruleId === "MAN.3.RL.17"));
});

test("crossProcess flag skips a rule even when source and target resolve", () => {
  const rule = {
    id: "TEST.RL.1",
    targets: [{ kind: "bp", process: "SUP.10", id: "BP3" }],
    effect: { kind: "cap-source" },
    condition: { kind: "rating", source: { kind: "bp", process: "SUP.10", id: "BP2" }, when: ["N", "P"], crossProcess: true },
    text: "x",
  };
  const bps = [{ id: "BP2", scorePercent: 10, rating: "N", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules: [rule] });
  assert.equal(bps[1].scorePercent, 90);
  assert.deepEqual(applied, []);
  // 같은 규칙에서 crossProcess 만 빼면 적용된다(위 단언이 실패할 수 있음을 보장)
  const live = { ...rule, condition: { ...rule.condition, crossProcess: undefined } };
  applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules: [live] });
  assert.equal(bps[1].scorePercent, 10);
});

test("scorer-written entry with the same ruleId does not block the engine", () => {
  const bps = [
    { id: "BP2", scorePercent: 10, rating: "N", gaps: [] },
    { id: "BP3", scorePercent: 90, rating: "F", gaps: [], appliedRules: [{ ruleId: "SUP.10.RL.5", applied: false, note: "" }] },
  ];
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  assert.equal(bps[1].scorePercent, 10);
  assert.ok(applied.some((a) => a.ruleId === "SUP.10.RL.5"));
  const entries = bps[1].appliedRules.filter((e) => e.ruleId === "SUP.10.RL.5");
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.source === "rule-engine" && e.capped === true));
  assert.ok(entries.some((e) => e.applied === false && e.source === undefined));
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

test("reason-qualified rules (SUP.10.RL.2/6/9/11 'due to …') are not applied from the source rating alone", () => {
  // 근거: 규칙 원문이 "…때문에 P/N 이라면" 이다. 출처가 P 여도 그 사유를 검증하지 않고 하향하면 오적용이다.
  // 시나리오 A: BP1=P, BP4=P → RL.2(BP1→BP2), RL.6(BP4→BP2), RL.11(BP1→BP6) 후보. 대상 BP2·BP6 는 높은 점수.
  const a = [
    { id: "BP1", scorePercent: 40, rating: "P+", gaps: [] },
    { id: "BP2", scorePercent: 95, rating: "F", gaps: [] },
    { id: "BP3", scorePercent: 95, rating: "F", gaps: [] },
    { id: "BP4", scorePercent: 40, rating: "P+", gaps: [] },
    { id: "BP5", scorePercent: 95, rating: "F", gaps: [] },
    { id: "BP6", scorePercent: 95, rating: "F", gaps: [] },
  ];
  const ra = applyRatingConditionRules({ processId: "SUP.10", bps: a, pas: [], rules });
  for (const id of ["SUP.10.RL.2", "SUP.10.RL.6", "SUP.10.RL.11"]) {
    assert.ok(!ra.applied.some((x) => x.ruleId === id), id + " must not be applied without a verified reason");
    assert.ok(ra.unverifiedReason.some((u) => u.ruleId === id), id + " must be reported as pending review");
  }
  assert.equal(a[1].scorePercent, 95);
  assert.equal(a[5].scorePercent, 95);
  // 시나리오 B: BP2=P → RL.9(BP2→BP5)는 사유 한정, RL.5(BP2→BP3)는 사유 없음.
  const b = [
    { id: "BP2", scorePercent: 40, rating: "P+", gaps: [] },
    { id: "BP3", scorePercent: 95, rating: "F", gaps: [] },
    { id: "BP5", scorePercent: 95, rating: "F", gaps: [] },
  ];
  const rb = applyRatingConditionRules({ processId: "SUP.10", bps: b, pas: [], rules });
  assert.ok(rb.applied.some((x) => x.ruleId === "SUP.10.RL.5"));
  assert.ok(!rb.applied.some((x) => x.ruleId === "SUP.10.RL.9"));
  assert.ok(rb.unverifiedReason.some((u) => u.ruleId === "SUP.10.RL.9"));
  assert.equal(b[2].scorePercent, 95);
});

test("idempotent: second run applies nothing new", () => {
  const bps = [{ id: "BP2", scorePercent: 40, rating: "P+", gaps: [] }, { id: "BP3", scorePercent: 90, rating: "F", gaps: [] }];
  const first = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  assert.ok(first.applied.length > 0);
  const gapsBefore = bps[1].gaps.length;
  const appliedRulesBefore = bps[1].appliedRules.length;
  const { applied } = applyRatingConditionRules({ processId: "SUP.10", bps, pas: [], rules });
  assert.deepEqual(applied, []);
  assert.equal(bps[1].gaps.length, gapsBefore);
  assert.equal(bps[1].appliedRules.length, appliedRulesBefore);
});

test("never raises a score already below the cap", () => {
  const pas = [{ paId: "PA 1.1", level: 1, rating: "P+", collapsed: "P", gps: [{ id: "GP 1.1.1", scorePercent: 40, rating: "P+", gaps: [] }] }];
  const { applied } = applyRatingConditionRules({ processId: "SUP.1", bps: [{ id: "BP3", scorePercent: 5, rating: "N", gaps: [] }], pas, rules });
  assert.equal(pas[0].gps[0].scorePercent, 40);
  assert.deepEqual(applied, []);
});
