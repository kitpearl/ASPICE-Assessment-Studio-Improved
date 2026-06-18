import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCharacteristics,
  loadRules,
  loadAttributes,
  isIncoseApplicable,
  lookupIncoseRefs,
  buildIncoseGuidance,
  getBpApplicability,
  _clearIncoseCache,
} from "../spec/incose/index.js";
import { hasIncoseRef } from "../src/evaluators/citationGuard.js";
import { evaluateBPs } from "../src/evaluators/bpEvaluator.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { loadProcess } from "../spec/canonical/index.js";
import { buildBpPrompt } from "../src/llm/prompts/bpPrompt.js";

test("characteristics: C1–C15 are loaded and indexed", () => {
  _clearIncoseCache();
  const { individual, set, byId } = loadCharacteristics();
  assert.equal(individual.length, 9, "expected C1–C9 individual characteristics");
  assert.equal(set.length, 6, "expected C10–C15 set characteristics");
  for (let n = 1; n <= 15; n++) assert.ok(byId.has(`C${n}`), `missing C${n}`);
  assert.equal(byId.get("C7").name, "Verifiable");
});

test("rules: R1–R42 load and every cross-ref characteristic exists", () => {
  _clearIncoseCache();
  const { list, byId } = loadRules();
  assert.equal(list.length, 42, "expected R1–R42");
  const { byId: charById } = loadCharacteristics();
  for (const r of list) {
    assert.ok(Array.isArray(r.characteristics), `${r.id} characteristics missing`);
    for (const cid of r.characteristics) {
      assert.ok(charById.has(cid), `${r.id} references unknown characteristic ${cid}`);
    }
  }
  assert.deepEqual(byId.get("R18").characteristics, ["C3", "C5", "C7", "C10", "C13"]);
});

test("attributes: minimum-set attributes are flagged", () => {
  _clearIncoseCache();
  const { byId } = loadAttributes();
  assert.ok(byId.size >= 49, `expected A1–A49, got ${byId.size}`);
  assert.equal(byId.get("A6").minimum, true, "A6 (verification success criteria) is a minimum attribute");
});

test("isIncoseApplicable: only requirements-analysis processes", () => {
  _clearIncoseCache();
  assert.ok(isIncoseApplicable("SYS.2"));
  assert.ok(isIncoseApplicable("SWE.1"));
  assert.ok(isIncoseApplicable("HWE.1"));
  assert.ok(!isIncoseApplicable("SWE.2"));
  assert.ok(!isIncoseApplicable("SYS.3"));
  assert.ok(!isIncoseApplicable(""));
  assert.ok(!isIncoseApplicable(undefined));
});

test("lookupIncoseRefs: BP1 yields guard-valid INCOSE citations; unmapped BP empty", () => {
  _clearIncoseCache();
  for (const bp of ["SYS.2.BP1", "SWE.1.BP1", "HWE.1.BP1"]) {
    const refs = lookupIncoseRefs(bp);
    assert.ok(refs.length > 0, `${bp} should carry INCOSE characteristic refs`);
    for (const r of refs) assert.ok(hasIncoseRef(r), `${bp}: "${r}" rejected by guard`);
    assert.ok(refs.includes("INCOSE GtWR C7"), `${bp} should be evaluated for Verifiable (C7)`);
  }
  assert.deepEqual(lookupIncoseRefs("SWE.2.BP1"), []);
  assert.deepEqual(lookupIncoseRefs("XYZ.9.BP9"), []);
});

test("getBpApplicability: every mapped rule/characteristic id resolves", () => {
  _clearIncoseCache();
  const { byId: charById } = loadCharacteristics();
  const { byId: ruleById } = loadRules();
  const { byId: attrById } = loadAttributes();
  for (const proc of ["SYS.2", "SWE.1", "HWE.1"]) {
    for (let n = 1; n <= 6; n++) {
      const entry = getBpApplicability(`${proc}.BP${n}`);
      assert.ok(entry, `${proc}.BP${n} applicability missing`);
      for (const c of [...(entry.individual ?? []), ...(entry.set ?? [])]) {
        assert.ok(charById.has(c), `${proc}.BP${n} unknown characteristic ${c}`);
      }
      for (const r of entry.rules ?? []) assert.ok(ruleById.has(r), `${proc}.BP${n} unknown rule ${r}`);
      for (const a of entry.attributes ?? []) assert.ok(attrById.has(a), `${proc}.BP${n} unknown attribute ${a}`);
    }
  }
});

test("buildIncoseGuidance: non-empty for req BP, empty otherwise", () => {
  _clearIncoseCache();
  const g = buildIncoseGuidance("SWE.1.BP1");
  assert.match(g, /INCOSE GtWR V4/);
  assert.match(g, /C7 Verifiable/);
  assert.match(g, /standardReferences\.incose/);
  assert.equal(buildIncoseGuidance("SWE.2.BP1"), "");
  assert.equal(buildIncoseGuidance("XYZ.9.BP9"), "");
});

test("evaluateBPs: SYS.2 BPResults carry INCOSE refs (applicable process)", async () => {
  _clearIncoseCache();
  const sys2 = loadProcess("SYS.2");
  const artifacts = [
    { name: "system_srs.md", text: "The system shall provide the function within 50 ms. Each requirement is verifiable." },
  ];
  const results = await evaluateBPs(sys2, artifacts, ruleScorer);
  const bp1 = results.find((r) => r.id === "BP1");
  assert.ok(bp1.standardReferences.incose.length > 0, "SYS.2.BP1 should carry INCOSE refs");
  for (const r of bp1.standardReferences.incose) assert.ok(hasIncoseRef(r));
});

test("evaluateBPs: non-applicable process never gets INCOSE refs", async () => {
  _clearIncoseCache();
  const swe2 = loadProcess("SWE.2");
  const results = await evaluateBPs(swe2, [{ name: "x.md", text: "unrelated architecture content" }], ruleScorer);
  for (const r of results) {
    assert.deepEqual(r.standardReferences.incose, [], `${r.id} must not carry INCOSE refs`);
    for (const f of r.findings) assert.deepEqual(f.standardReferences.incose, []);
  }
});

test("bpPrompt: applicable BP injects INCOSE lens + schema slot; non-applicable does not", () => {
  _clearIncoseCache();
  const sys2 = loadProcess("SYS.2");
  const bp1 = sys2.basePractices.find((b) => b.id === "BP1");
  const { task } = buildBpPrompt({ process: sys2, bp: bp1, artifactsExcerpt: "", projectFingerprint: "" });
  assert.match(task, /INCOSE GtWR V4/);
  assert.match(task, /"incose":/);

  const swe2 = loadProcess("SWE.2");
  const swe2bp1 = swe2.basePractices.find((b) => b.id === "BP1");
  const { task: t2 } = buildBpPrompt({ process: swe2, bp: swe2bp1, artifactsExcerpt: "", projectFingerprint: "" });
  assert.doesNotMatch(t2, /INCOSE GtWR V4/);
  assert.doesNotMatch(t2, /"incose":/);
});
