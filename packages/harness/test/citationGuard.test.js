import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasPamCitation,
  hasPamNote,
  hasBgbRL,
  hasIsoClause,
  normalizeStandardReferences,
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

test("hasBgbRL: accepts 'RL<digit>' with optional .sub", () => {
  assert.ok(hasBgbRL("RL3"));
  assert.ok(hasBgbRL("RL12"));
  assert.ok(hasBgbRL("RL3.2"));
  assert.ok(!hasBgbRL("RL"));
  assert.ok(!hasBgbRL("rl3"));
  assert.ok(!hasBgbRL("RL-3"));
  assert.ok(!hasBgbRL("BGB-RL3"));
});

test("hasIsoClause: accepts ISO/IEC variants with optional clause", () => {
  assert.ok(hasIsoClause("ISO 26262-6:2018 §8.4.5"));
  assert.ok(hasIsoClause("ISO/IEC 33020:2019 §5.3"));
  assert.ok(hasIsoClause("ISO 21434"));
  assert.ok(hasIsoClause("ISO 26262-6:2018"));
  assert.ok(!hasIsoClause("ISO26262"));
  assert.ok(!hasIsoClause("iso 26262"));
  assert.ok(!hasIsoClause("ISO 26262-6 clause 8.4.5"));
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
