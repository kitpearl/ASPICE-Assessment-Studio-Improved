import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasPamCitation,
  hasPamNote,
  hasBgbRL,
  hasIsoClause,
  normalizeStandardReferences,
  normalizeFindings,
  validateLlmResult,
} from "../src/evaluators/citationGuard.js";

test("hasPamCitation: accepts valid shapes", () => {
  assert.ok(hasPamCitation("PAM §4.3.2"));
  assert.ok(hasPamCitation("PAM §4.3.2 BP5"));
  assert.ok(hasPamCitation("PAM §5.3.1 GP 2.1.1"));
  assert.ok(hasPamCitation("PAM § 3.2.2"));
  assert.ok(hasPamCitation("PAM §SWE.2 BP1"));
  assert.ok(hasPamCitation("PAM §SUP.10"));
});

test("hasPamCitation: rejects malformed / missing citations", () => {
  assert.ok(!hasPamCitation(""));
  assert.ok(!hasPamCitation(undefined));
  assert.ok(!hasPamCitation("see the PAM"));
  assert.ok(!hasPamCitation("§4.3.2"));
  assert.ok(!hasPamCitation("PAM section 4"));
});

test("validateLlmResult: accepts well-formed LLM verdict", () => {
  const v = validateLlmResult({
    scorePercent: 72,
    evidence: [{ artifactName: "srs.docx", quote: "..." }],
    gaps: [],
    pamCitation: "PAM §4.3.2 BP5",
  });
  assert.ok(v.ok);
  assert.equal(v.result.scorePercent, 72);
  assert.equal(v.result.contextConsistency.status, "unknown");
});

test("validateLlmResult: keeps contextConsistency when supplied", () => {
  const v = validateLlmResult({
    scorePercent: 50,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §4.3.2 BP5",
    contextConsistency: { status: "off-context", note: "다른 프로젝트 자료로 보임" },
  });
  assert.ok(v.ok);
  assert.equal(v.result.contextConsistency.status, "off-context");
  assert.match(v.result.contextConsistency.note, /다른 프로젝트/);
});

test("validateLlmResult: normalizes invalid contextConsistency to unknown", () => {
  const v = validateLlmResult({
    scorePercent: 50,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §4.3.2",
    contextConsistency: { status: "totally-broken", note: 123 },
  });
  assert.ok(v.ok);
  assert.equal(v.result.contextConsistency.status, "unknown");
  assert.equal(v.result.contextConsistency.note, "");
});

test("validateLlmResult: rejects missing citation", () => {
  const v = validateLlmResult({ scorePercent: 60, evidence: [], gaps: [] });
  assert.ok(!v.ok);
  assert.match(v.reason, /citation/);
});

test("validateLlmResult: rejects out-of-range score", () => {
  const v = validateLlmResult({
    scorePercent: 150,
    pamCitation: "PAM §4.3.2",
    evidence: [],
    gaps: [],
  });
  assert.ok(!v.ok);
  assert.match(v.reason, /out of range/);
});

test("hasPamNote: accepts 'PAM Note <PROC>.<n>-<m>'", () => {
  assert.ok(hasPamNote("PAM Note SWE.2-1"));
  assert.ok(hasPamNote("PAM Note SYS.1-12"));
  assert.ok(hasPamNote("PAM Note HWE.1-3"));
  assert.ok(!hasPamNote("PAM Note SWE.2"));
  assert.ok(!hasPamNote("Note SWE.2-1"));
  assert.ok(!hasPamNote(""));
  assert.ok(!hasPamNote(undefined));
});

test("hasBgbRL: accepts 'RL<digit>' with optional .sub (legacy compat)", () => {
  assert.ok(hasBgbRL("RL3"));
  assert.ok(hasBgbRL("RL12"));
  assert.ok(hasBgbRL("RL3.2"));
  assert.ok(!hasBgbRL("RL"));
  assert.ok(!hasBgbRL("rl3"));
  assert.ok(!hasBgbRL("RL-3"));
  assert.ok(!hasBgbRL("BGB-RL3"));
});

test("hasBgbRL: accepts BGB rule-ID form '[PROC.RL.N]' (P5-bis canonical)", () => {
  assert.ok(hasBgbRL("[SYS.2.RL.2]"));
  assert.ok(hasBgbRL("[SWE.3.RL.1]"));
  assert.ok(hasBgbRL("[SUP.10.RL.11]"));
  assert.ok(hasBgbRL("[GEN.RL.1]"));
  assert.ok(hasBgbRL("[MBD.RL.7]"));
  assert.ok(hasBgbRL("[PA2.1.RL.5]"));
  assert.ok(hasBgbRL("[CL2.RL.xx]"));
  assert.ok(!hasBgbRL("[SYS.2.RL]"));
  assert.ok(!hasBgbRL("SYS.2.RL.2"));
  assert.ok(!hasBgbRL("[sys.2.RL.2]"));
});

test("hasIsoClause: accepts ISO/IEC variants with § clause notation", () => {
  assert.ok(hasIsoClause("ISO 26262-6:2018 §8.4.5"));
  assert.ok(hasIsoClause("ISO/IEC 33020:2019 §5.3"));
  assert.ok(hasIsoClause("ISO 21434"));
  assert.ok(hasIsoClause("ISO 26262-6:2018"));
  assert.ok(!hasIsoClause("ISO26262"));
  assert.ok(!hasIsoClause("iso 26262"));
});

test("hasIsoClause: P5-ter — accepts the PAM v4.0 'clause N.N.N' notation", () => {
  assert.ok(hasIsoClause("ISO 26262-6 clause 8.4.5"));
  assert.ok(hasIsoClause("ISO 26262-6 clause 9"));
  assert.ok(hasIsoClause("IEC 61508 clause 7.2"));
});

test("hasIsoClause: P5-ter — accepts ISO/SAE, IEC, IATF prefixes", () => {
  assert.ok(hasIsoClause("ISO/SAE 21434"));
  assert.ok(hasIsoClause("IEC 33020:2019"));
  assert.ok(hasIsoClause("IATF 16949:2016 clause 8.4.1.2"));
  assert.ok(!hasIsoClause("iatf 16949"));
  assert.ok(!hasIsoClause("ISO/foo 12345"));
});

test("normalizeStandardReferences: keeps valid entries, drops malformed ones", () => {
  const { refs, dropped } = normalizeStandardReferences({
    pam: ["PAM §SWE.2 BP1", "not a citation"],
    pamNote: ["PAM Note SWE.2-1"],
    bgbRL: ["RL3", "RL3.2", "RL-bad"],
    iso: ["ISO 26262-6:2018 §8.4.5"],
  });
  assert.deepEqual(refs.pam, ["PAM §SWE.2 BP1"]);
  assert.deepEqual(refs.pamNote, ["PAM Note SWE.2-1"]);
  assert.deepEqual(refs.bgbRL, ["RL3", "RL3.2"]);
  assert.deepEqual(refs.iso, ["ISO 26262-6:2018 §8.4.5"]);
  assert.ok(dropped.includes("pam:not a citation"));
  assert.ok(dropped.includes("bgbRL:RL-bad"));
});

test("normalizeStandardReferences: undefined / non-object yields empty slots", () => {
  for (const x of [undefined, null, 42, "string", []]) {
    const { refs, dropped } = normalizeStandardReferences(x);
    assert.deepEqual(refs, { pam: [], pamNote: [], bgbRL: [], iso: [] });
    assert.deepEqual(dropped, []);
  }
});

test("validateLlmResult: surfaces standardReferences when supplied", () => {
  const v = validateLlmResult({
    scorePercent: 60,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §SWE.2 BP1",
    standardReferences: {
      pam: ["PAM §SWE.2 BP1"],
      pamNote: ["PAM Note SWE.2-1"],
      bgbRL: ["RL3"],
      iso: ["ISO 26262-6:2018 §8.4.5", "bogus"],
    },
  });
  assert.ok(v.ok);
  assert.deepEqual(v.result.standardReferences.bgbRL, ["RL3"]);
  assert.deepEqual(v.result.standardReferences.iso, ["ISO 26262-6:2018 §8.4.5"]);
  assert.ok(v.result.droppedRefs.includes("iso:bogus"));
});

test("validateLlmResult: missing standardReferences yields empty slots and no drops", () => {
  const v = validateLlmResult({
    scorePercent: 60,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §SWE.2 BP1",
  });
  assert.ok(v.ok);
  assert.deepEqual(v.result.standardReferences, { pam: [], pamNote: [], bgbRL: [], iso: [] });
  assert.deepEqual(v.result.droppedRefs, []);
});

test("normalizeFindings: keeps valid weakness, drops findings without verb-first recommendation", () => {
  const { findings, dropped } = normalizeFindings([
    {
      id: "F-SWE.2.BP1-01",
      bpId: "SWE.2.BP1",
      type: "weakness",
      situation: "정적 아키텍처 명세 부분 존재",
      gap: "외부 인터페이스 타이밍 정의 부재",
      impact: "BP1 outcome 부분 충족",
      recommendation: "추가하라: 외부 인터페이스 타이밍 정의",
      standardReferences: { pam: ["PAM §SWE.2 BP1"], iso: ["ISO 26262-6:2018 §8.4.5"] },
    },
    {
      id: "F-SWE.2.BP1-02",
      bpId: "SWE.2.BP1",
      type: "weakness",
      situation: "동적 아키텍처 명세 부재",
      gap: "동적 view 정의 누락",
      recommendation: "이걸 좀 채워주면 좋겠다",
    },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, "F-SWE.2.BP1-01");
  assert.deepEqual(findings[0].standardReferences.iso, ["ISO 26262-6:2018 §8.4.5"]);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], /\[1\]/);
  assert.match(dropped[0], /동사/);
});

test("normalizeFindings: non-object / null entries are dropped with index", () => {
  const { findings, dropped } = normalizeFindings([null, 42, "x", undefined]);
  assert.equal(findings.length, 0);
  assert.deepEqual(dropped, ["[0]:<non-object>", "[1]:<non-object>", "[2]:<non-object>", "[3]:<non-object>"]);
});

test("normalizeFindings: non-array input yields empty result", () => {
  for (const x of [undefined, null, 42, "string", {}]) {
    const { findings, dropped } = normalizeFindings(x);
    assert.deepEqual(findings, []);
    assert.deepEqual(dropped, []);
  }
});

test("normalizeFindings: malformed nested standardReferences are silently scrubbed", () => {
  const { findings } = normalizeFindings([
    {
      bpId: "SWE.2.BP1",
      type: "observation",
      situation: "정적 아키텍처 명세 존재",
      standardReferences: { pam: ["bogus"], iso: ["ISO 26262-6:2018 §8.4.5", "nope"] },
    },
  ]);
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].standardReferences.pam, []);
  assert.deepEqual(findings[0].standardReferences.iso, ["ISO 26262-6:2018 §8.4.5"]);
});

test("validateLlmResult: surfaces findings + droppedFindings", () => {
  const v = validateLlmResult({
    scorePercent: 60,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §SWE.2 BP1",
    findings: [
      {
        bpId: "SWE.2.BP1",
        type: "observation",
        situation: "정적 아키텍처 명세 존재",
      },
      { bpId: "", type: "weakness" },
    ],
  });
  assert.ok(v.ok);
  assert.equal(v.result.findings.length, 1);
  assert.equal(v.result.droppedFindings.length, 1);
});

test("validateLlmResult: missing findings yields empty array and no drops", () => {
  const v = validateLlmResult({
    scorePercent: 60,
    evidence: [],
    gaps: [],
    pamCitation: "PAM §SWE.2 BP1",
  });
  assert.ok(v.ok);
  assert.deepEqual(v.result.findings, []);
  assert.deepEqual(v.result.droppedFindings, []);
});
