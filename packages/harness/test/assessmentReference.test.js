import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcesses } from "../spec/canonical/index.js";
import { loadReferenceTable, buildReferenceSkeleton, validateReferenceTable, renderReferenceMarkdown } from "../src/assessment/referenceTable.js";

test("[real] SUP.10 참조 판정표: 구조·증거·규칙 참조가 유효하고 확정 등급을 포함하지 않는다", async () => {
  const t = await loadReferenceTable("SUP.10");
  assert.equal(t.curation, "CURATED");
  assert.deepEqual(validateReferenceTable(t), []);
  assert.equal(t.bps.length, 6, "공식 PAM 4.1 SUP.10 BP1~BP6");
  assert.equal(t.documentBpMapping.documentBpCount, 8);
  assert.match(t.disclaimer, /정답으로 고정하지 않으며/);
  // 조건 TRUE/FALSE 는 증거 필요, 확정 등급 필드 금지는 validate 가 검사
  const rl3 = t.bps.find((b) => b.bpId === "SUP.10.BP3").relatedRules.find((r) => r.ruleId === "SUP.10.RL.3");
  assert.equal(rl3.conditionResult, "UNKNOWN");
  // 모든 엔진 지적에 분류와 근거가 있다
  for (const bp of t.bps) for (const j of bp.engineJudgments) assert.ok(j.rationale.length > 10, j.claimId);
  const md = renderReferenceMarkdown(t);
  assert.match(md, /FALSE_POSITIVE/);
  assert.match(md, /Closed with Risk Acceptance/);
});

test("참조표 검증기는 확정 등급 필드·존재하지 않는 증거 참조·잘못된 분류를 거부한다 [synthetic]", () => {
  const t = structuredClone(buildReferenceSkeleton("SUP.10"));
  t.bps[0].rating = "F";
  t.bps[0].engineJudgments.push({ claimId: "x", engine: "RULE", claim: "c", classification: "MAYBE", rationale: "", evidenceIds: ["EV-NONE"] });
  const p = validateReferenceTable(t).join("\n");
  assert.match(p, /확정 등급 필드/);
  assert.match(p, /잘못된 분류/);
  assert.match(p, /EV-NONE/);
});

test("[generalization] 모든 프로세스: 공식 BP 기준 참조표 골격이 유효하다", () => {
  for (const proc of loadProcesses()) {
    const t = buildReferenceSkeleton(proc.id);
    assert.deepEqual(validateReferenceTable(t), [], proc.id);
    assert.equal(t.bps.length, proc.basePractices.length);
    assert.ok(t.bps.every((b) => b.expectations.length >= 1), proc.id);
  }
});
