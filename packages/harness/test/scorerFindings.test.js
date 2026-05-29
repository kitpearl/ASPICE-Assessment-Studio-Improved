import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { createCustomScorer } from "../src/evaluators/customScorer.js";
import { createHybridScorer } from "../src/evaluators/hybridScorer.js";
import { loadProcess, loadProcessAttributes } from "../spec/canonical/index.js";

const PROC = { id: "SYS.2", name: "System Requirements Analysis", pamSection: "4.3.2" };

test("ruleScorer.scoreBP: emits observation finding with rule-mode framing", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const r = await ruleScorer.scoreBP({
    process: sys2,
    bp: bp5,
    artifacts: [
      {
        name: "Traceability_Matrix.xlsx",
        text:
          "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
      },
    ],
  });
  assert.equal(r.findings.length, 1);
  const f = r.findings[0];
  assert.equal(f.type, "observation");
  assert.equal(f.bpId, "SYS.2.BP5");
  assert.match(f.situation, /Rule-mode/);
  assert.match(f.recommendation, /^검토하라/);
  assert.equal(f.ratingImpact.ruleApplied, true);
  assert.equal(f.ratingImpact.ruleId, "RULE-KEYWORD-OVERLAP");
  assert.match(f.ratingImpact.reason, /^계산하라/);
  // BP-level standardReferences should carry the BP's PAM citation
  assert.ok(Array.isArray(r.standardReferences.pam) && r.standardReferences.pam.length > 0);
});

test("ruleScorer.scoreBP: even no-evidence path produces an observation finding", async () => {
  const sys2 = loadProcess("SYS.2");
  const bp1 = sys2.basePractices.find((b) => b.id === "BP1");
  const r = await ruleScorer.scoreBP({
    process: sys2,
    bp: bp1,
    artifacts: [{ name: "unrelated.md", text: "hello world" }],
  });
  assert.equal(r.scorePercent, 0);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].type, "observation");
});

test("ruleScorer.scoreWP: emits finding scoped to WP id", async () => {
  const wp = { id: "17-00", name: "Requirement" };
  const r = await ruleScorer.scoreWP({
    process: PROC,
    wp,
    artifacts: [{ name: "srs.docx", wpidCandidates: ["17-00"], text: "" }],
  });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].bpId, "SYS.2.17-00");
  assert.equal(r.findings[0].ratingImpact.ruleId, "RULE-WPID-OR-NAME");
  assert.match(r.findings[0].situation, /Rule-mode/);
});

test("ruleScorer.scoreGP PA 1.1: finding mentions BP-derived computation", async () => {
  const pas = loadProcessAttributes();
  const paSpec = pas["PA 1.1"];
  const gp = paSpec.genericPractices[0];
  const r = await ruleScorer.scoreGP({
    process: PROC,
    paSpec,
    gp,
    bpResults: [
      { id: "BP1", scorePercent: 80 },
      { id: "BP2", scorePercent: 40 },
    ],
    artifacts: [],
  });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].ratingImpact.ruleId, "RULE-GP-DERIVED-FROM-BP");
  assert.match(r.findings[0].situation, /BP 결과로부터 파생/);
});

test("customScorer: emits one observation finding per applied rule", async () => {
  const scorer = createCustomScorer({
    ruleBook: {
      rules: [
        {
          id: "r-trace",
          enabled: true,
          label: "traceability rule",
          appliesTo: "bp",
          process: "*",
          match: "any",
          keywords: ["traceability"],
          weight: 1,
        },
        {
          id: "r-missing",
          enabled: true,
          label: "missing concept",
          appliesTo: "bp",
          process: "*",
          match: "any",
          keywords: ["nonexistent-concept-xyz"],
          weight: 1,
        },
      ],
    },
  });
  const r = await scorer.scoreBP({
    process: PROC,
    bp: { id: "BP1", title: "Specify reqs", description: "" },
    artifacts: [{ name: "doc.pdf", text: "full traceability matrix attached" }],
  });
  assert.equal(r.findings.length, 2);
  const satisfied = r.findings.find((f) => /충족:/.test(f.situation));
  const unsatisfied = r.findings.find((f) => /미충족:/.test(f.situation));
  assert.ok(satisfied, "expected one satisfied-rule finding");
  assert.ok(unsatisfied, "expected one unsatisfied-rule finding");
  assert.equal(satisfied.bpId, "SYS.2.BP1");
  assert.match(satisfied.ratingImpact.ruleId, /^CUSTOM:/);
  assert.equal(satisfied.type, "observation");
});

test("customScorer: rule-empty + fallback path forwards fallback's findings", async () => {
  const scorer = createCustomScorer({
    ruleBook: { rules: [], useAutoFallback: true },
    fallback: ruleScorer,
  });
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const r = await scorer.scoreBP({
    process: sys2,
    bp: bp5,
    artifacts: [
      {
        name: "Trace.xlsx",
        text:
          "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
      },
    ],
  });
  assert.ok(r.findings.length >= 1);
  assert.equal(r.findings[0].ratingImpact.ruleId, "RULE-KEYWORD-OVERLAP");
});

test("hybridScorer: merges rule + llm findings and unions standardReferences", async () => {
  const fakeLlm = {
    async scoreBP() {
      return {
        scorePercent: 70,
        evidence: [{ artifactName: "doc.pdf", quote: "LLM 인용", location: "§3" }],
        gaps: [],
        pamCitation: "PAM §SYS.2 BP1",
        contextConsistency: { status: "consistent", note: "" },
        standardReferences: { pam: ["PAM §SYS.2 BP1"], pamNote: [], bgbRL: ["RL3"], iso: [] },
        findings: [
          {
            id: "F-SYS.2.BP1-01",
            bpId: "SYS.2.BP1",
            type: "weakness",
            situation: "LLM 관찰",
            gap: "x 부재",
            impact: "BP1 미흡",
            recommendation: "추가하라: x 정의",
            location: { found: null, recommended: null },
            evidence: [],
            standardReferences: { pam: ["PAM §SYS.2 BP1"], pamNote: [], bgbRL: [], iso: [] },
            ratingImpact: { ruleApplied: false, ruleId: null, scoreDelta: -10, reason: "감점하라: x 부재" },
          },
        ],
      };
    },
    async scoreWP() { return { scorePercent: 0, evidence: [], gaps: [], findings: [] }; },
    async scoreGP() { return { scorePercent: 0, evidence: [], gaps: [], findings: [] }; },
  };
  const hybrid = createHybridScorer({ rule: ruleScorer, llm: fakeLlm });
  const sys2 = loadProcess("SYS.2");
  const bp5 = sys2.basePractices.find((b) => b.id === "BP5");
  const r = await hybrid.scoreBP({
    process: sys2,
    bp: bp5,
    artifacts: [
      {
        name: "Trace.xlsx",
        text:
          "This matrix establishes bidirectional traceability between system requirements and stakeholder requirements for consistency verification.",
      },
    ],
  });
  // LLM weakness + rule observation = 2 findings
  assert.equal(r.findings.length, 2);
  assert.equal(r.findings[0].type, "weakness", "LLM finding should come first");
  assert.equal(r.findings[1].type, "observation");
  // standardReferences union: PAM from both, BGB RL3 from LLM
  assert.ok(r.standardReferences.pam.length >= 1);
  assert.deepEqual(r.standardReferences.bgbRL, ["RL3"]);
});
