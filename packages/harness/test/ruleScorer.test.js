import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { loadProcess, loadProcessAttributes } from "../spec/canonical/index.js";

test("ruleScorer.scoreBP: high score when keywords are present", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const artifacts = [
    {
      name: "Traceability_Matrix.xlsx",
      text:
        "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
    },
  ];
  const r = await ruleScorer.scoreBP({ process: sys2, bp: bp5, artifacts });
  assert.ok(r.scorePercent >= 51, `expected Largely+, got ${r.scorePercent}%`);
  assert.ok(r.evidence.length > 0);
});

test("ruleScorer.scoreBP: zero when no artifacts match", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp1 = sys2.basePractices.find((b) => b.id === "BP1");
  const r = await ruleScorer.scoreBP({
    process: sys2,
    bp: bp1,
    artifacts: [{ name: "unrelated.md", text: "hello world" }],
  });
  assert.equal(r.scorePercent, 0);
  assert.ok(r.gaps.length > 0);
});

const STUB_PROC = { id: "SYS.2", name: "System Requirements Analysis", pamSection: "4.3.2" };

test("ruleScorer.scoreWP: 90 when artifact tagged with matching WPID", async () => {
  const wp = { id: "17-00", name: "Requirement" };
  const r = await ruleScorer.scoreWP({
    process: STUB_PROC,
    wp,
    artifacts: [{ name: "srs.docx", wpidCandidates: ["17-00"], text: "" }],
  });
  assert.equal(r.scorePercent, 90);
  assert.ok(r.evidence[0].artifactName === "srs.docx");
});

test("ruleScorer.scoreWP: 60 when name matches but no WPID tagging", async () => {
  const wp = { id: "13-51", name: "Consistency Evidence" };
  const r = await ruleScorer.scoreWP({
    process: STUB_PROC,
    wp,
    artifacts: [{ name: "x.md", wpidCandidates: [], text: "This is a consistency evidence review record." }],
  });
  assert.equal(r.scorePercent, 60);
});

test("ruleScorer.scoreWP: 0 when nothing matches", async () => {
  const wp = { id: "17-54", name: "Requirement Attribute" };
  const r = await ruleScorer.scoreWP({
    process: STUB_PROC,
    wp,
    artifacts: [{ name: "unrelated.pdf", wpidCandidates: [], text: "completely off-topic" }],
  });
  assert.equal(r.scorePercent, 0);
});

test("ruleScorer.scoreGP PA 1.1: inherits average of BP scores", async () => {
  const pas = loadProcessAttributes();
  const paSpec = pas["PA 1.1"];
  const gp = paSpec.genericPractices[0];
  const r = await ruleScorer.scoreGP({
    process: STUB_PROC,
    paSpec,
    gp,
    bpResults: [
      { id: "BP1", scorePercent: 80 },
      { id: "BP2", scorePercent: 60 },
      { id: "BP3", scorePercent: 40 },
    ],
    artifacts: [],
  });
  assert.equal(r.scorePercent, 60);
});

test("ruleScorer.scoreBP: down-weights matches from off-context artifacts", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const onCtx = {
    name: "BMS-Trace.xlsx",
    text: "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
  };
  const offCtx = {
    name: "ADAS-Trace.xlsx",
    text: "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
  };
  // Fingerprint says only BMS-Trace is on-context. ADAS-Trace is severely off.
  const fingerprint = {
    dominant: ["BMS"],
    perArtifact: [
      { name: "BMS-Trace.xlsx", terms: ["BMS"], hits: ["BMS"], contextMatch: 1.0 },
      { name: "ADAS-Trace.xlsx", terms: ["ADAS"], hits: [], contextMatch: 0.0 },
    ],
  };
  const onScore = await ruleScorer.scoreBP({ process: sys2, bp: bp5, artifacts: [onCtx], projectFingerprint: fingerprint });
  const offScore = await ruleScorer.scoreBP({ process: sys2, bp: bp5, artifacts: [offCtx], projectFingerprint: fingerprint });
  assert.ok(offScore.scorePercent < onScore.scorePercent, `off-context score (${offScore.scorePercent}) should be < on-context (${onScore.scorePercent})`);
  assert.equal(offScore.contextConsistency.status, "off-context");
  assert.ok(offScore.gaps.some((g) => /컨텍스트 불일치/.test(g)));
});

test("ruleScorer.scoreWP: applies context penalty even when WPID matches", async () => {
  const wp = { id: "17-00", name: "Requirement" };
  const fingerprint = {
    dominant: ["BMS"],
    perArtifact: [
      { name: "ADAS-srs.docx", terms: ["ADAS"], hits: [], contextMatch: 0.0 },
    ],
  };
  const r = await ruleScorer.scoreWP({
    process: STUB_PROC,
    wp,
    artifacts: [{ name: "ADAS-srs.docx", wpidCandidates: ["17-00"], text: "" }],
    projectFingerprint: fingerprint,
  });
  // Pre-upgrade behaviour was scorePercent=90; with context penalty this must drop.
  assert.ok(r.scorePercent < 90, `expected penalty to lower score below 90, got ${r.scorePercent}`);
  assert.equal(r.contextConsistency.status, "off-context");
});

test("ruleScorer.scoreBP: no fingerprint preserves legacy scoring", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const r = await ruleScorer.scoreBP({
    process: sys2,
    bp: bp5,
    artifacts: [
      {
        name: "Trace.xlsx",
        text: "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
      },
    ],
    // no projectFingerprint passed
  });
  assert.ok(r.scorePercent >= 51, `legacy path should still pass Largely+, got ${r.scorePercent}%`);
  assert.equal(r.contextConsistency.status, "unknown");
});

const bilingualBp = { id: "BP5", title: "일관성을 보장하고 양방향 추적성을 수립한다", description: "소프트웨어 요구사항과 시스템 요구사항 간의 일관성을 보장하고 양방향 추적성을 수립한다.", titleEn: "Ensure consistency and establish bidirectional traceability", descriptionEn: "Ensure consistency and establish bidirectional traceability between software requirements and system requirements." };

test("ruleScorer.scoreBP bilingual: korean-only artifact scores by korean keywords", async () => {
  const r = await ruleScorer.scoreBP({ process: { id: "SWE.1" }, bp: bilingualBp, artifacts: [{ name: "trace-ko.xlsx", text: "본 문서는 소프트웨어 요구사항과 시스템 요구사항 간 양방향 추적성과 일관성을 보장하기 위한 추적성 매트릭스이다." }] });
  assert.ok(r.scorePercent >= 51, `got ${r.scorePercent}`);
});

test("ruleScorer.scoreBP bilingual: english artifact unaffected by korean keywords", async () => {
  const r = await ruleScorer.scoreBP({ process: { id: "SWE.1" }, bp: bilingualBp, artifacts: [{ name: "Traceability_Matrix.xlsx", text: "This traceability matrix ensures consistency and bidirectional traceability between software requirements and system requirements." }] });
  assert.ok(r.scorePercent >= 51, `got ${r.scorePercent}`);
});

test("ruleScorer.scoreWP: alias hit scores 60 and evidence points at the matching artifact", async () => {
  const wp = { id: "17-00", name: "요구사항 명세", nameEn: "Requirement", aliases: ["srs document"] };
  const r = await ruleScorer.scoreWP({ wp, artifacts: [
    { name: "a.txt", text: "nothing relevant" },
    { name: "b.txt", text: "This is the SRS Document for the project." },
  ] });
  assert.equal(r.scorePercent, 60);
  assert.equal(r.evidence[0].artifactName, "b.txt");
  assert.match(r.evidence[0].quote, /SRS Document/);
});

test("ruleScorer.scoreWP: nameEn hit when name is Korean", async () => {
  const wp = { id: "17-00", name: "요구사항 명세", nameEn: "Requirement", aliases: [] };
  const r = await ruleScorer.scoreWP({ wp, artifacts: [{ name: "a.txt", text: "Software requirement list" }] });
  assert.equal(r.scorePercent, 60);
});

test("ruleScorer.scoreWP: korean name shorter than 5 chars is not a needle", async () => {
  const wp = { id: "17-00", name: "요구사항", nameEn: "Requirement", aliases: [] };
  const r = await ruleScorer.scoreWP({ wp, artifacts: [{ name: "a.txt", text: "요구사항 목록" }] });
  assert.equal(r.scorePercent, 0);
});

test("ruleScorer.scoreWP: exact name hit still scores 60", async () => {
  const wp = { id: "17-00", name: "Requirement" };
  const r = await ruleScorer.scoreWP({ wp, artifacts: [{ name: "a.txt", text: "The requirement set" }] });
  assert.equal(r.scorePercent, 60);
});

test("ruleScorer.scoreBP english-only BP: half of english keywords matched scores 83 (generosity curve)", async () => {
  const bp = { id: "BP1", title: "alpha bravo", description: "charlie delta" };
  const r = await ruleScorer.scoreBP({ bp, artifacts: [{ name: "x.txt", text: "alpha bravo only" }] });
  assert.equal(r.scorePercent, 83); // 50 + 50 * 0.5^0.6
  assert.deepEqual(r.gaps[0], "No evidence found for keywords: charlie, delta");
});

test("ruleScorer attaches references and hints on low score", async () => {
  const swe1 = loadProcess("SWE.1");
  const r = await ruleScorer.scoreBP({ process: swe1, bp: swe1.basePractices[2], artifacts: [{ name: "x.md", text: "hello" }] });
  assert.equal(r.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP3");
  assert.ok(r.gaps.some((g) => /^확인 포인트 \[SWE\.1\.RL\.\d+\]/.test(g)));
});

test("ruleScorer adds no hints on high score and knowledge never changes the score", async () => {
  const swe1 = loadProcess("SWE.1");
  const bp = swe1.basePractices[2];
  const text = [bp.title, bp.titleEn, bp.description, ...(bp.notes ?? [])].filter(Boolean).join("\n");
  const artifacts = [{ name: "swe1_bp3.md", text }];
  const withKb = await ruleScorer.scoreBP({ process: swe1, bp, artifacts });
  const withoutKb = await ruleScorer.scoreBP({ process: { ...swe1, id: "ZZZ.9" }, bp, artifacts });
  assert.ok(withKb.scorePercent >= 51, `expected high score, got ${withKb.scorePercent}`);
  assert.ok(withKb.references, "knowledge references attached");
  assert.equal("references" in withoutKb, false);
  assert.equal(withKb.scorePercent, withoutKb.scorePercent);
  assert.ok(!withKb.gaps.some((g) => g.startsWith("확인 포인트")));
});

test("ruleScorer omits references for ad-hoc process objects", async () => {
  const r = await ruleScorer.scoreBP({
    process: { id: "ZZZ.9", basePractices: [] },
    bp: { id: "BP1", title: "requirements analysis", description: "analyze requirements" },
    artifacts: [{ name: "x.md", text: "hello" }],
  });
  assert.equal("references" in r, false);
});
