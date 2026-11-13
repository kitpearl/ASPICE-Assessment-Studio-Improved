import { test } from "node:test";
import assert from "node:assert/strict";
import { cappedRules, referencesToText } from "../../../src/utils/references.js";

const references = {
  pam: { citation: "PAM 4.1 §4.4.1 SWE.1.BP2", page: 50 },
  guideline: [
    { id: "SWE.1.RL.4", effect: "cap:N", section: "3.4.2", page: 60, summary: "요약" },
    { id: "SWE.1.RL.6", effect: "must-downrate", summary: "요약" },
    { id: "SWE.1.RL.9", effect: "cap:P", summary: "요약" },
  ],
};

test("cappedRules: only capped, applied entries, with cap label and who applied it", () => {
  const out = cappedRules(references, [
    { ruleId: "SWE.1.RL.4", applied: true, capped: true, note: "기능/비기능만 분류", source: undefined },
    { ruleId: "SWE.1.RL.6", applied: true, capped: true, note: "", source: "rule-engine" },
    { ruleId: "SWE.1.RL.9", applied: false, capped: true, note: "[보류: 근거 없음]" }, // 보류 → 제외
    { ruleId: "SWE.1.RL.4", applied: true, capped: true, note: "중복" }, // 중복 제거
    { ruleId: "X", applied: true, note: "capped 아님" },
    null,
  ]);
  assert.deepEqual(out, [
    { id: "SWE.1.RL.4", capLabel: "상한 N", source: "LLM 판단", note: "기능/비기능만 분류" },
    { id: "SWE.1.RL.6", capLabel: "상한 L", source: "규칙 엔진", note: "" },
  ]);
});

test("cappedRules: unknown effect falls back to a generic label; bad input yields []", () => {
  assert.equal(cappedRules(undefined, [{ ruleId: "A", applied: true, capped: true }])[0].capLabel, "등급 상한");
  assert.deepEqual(cappedRules(references, undefined), []);
  assert.deepEqual(cappedRules(undefined, null), []);
});

test("referencesToText marks the capped rule as (적용)", () => {
  const t = referencesToText(references, [{ ruleId: "SWE.1.RL.4", applied: true, capped: true }], { pamSep: " / " });
  assert.match(t, /PAM 4\.1 §4\.4\.1 SWE\.1\.BP2 · p\.50 \/ /);
  assert.match(t, /\[SWE\.1\.RL\.4\] N 상한\(적용\)/);
});
