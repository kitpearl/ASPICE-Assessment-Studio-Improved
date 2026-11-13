import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Harness } from "../src/harness.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadFixture(name) {
  const path = resolve(__dirname, "fixtures", name);
  const text = await readFile(path, "utf8");
  return {
    name,
    path,
    mimeType: "text/plain",
    sizeBytes: text.length,
    text,
  };
}

test("e2e: evaluate SYS.2 against fixture artifacts with ruleScorer", async () => {
  const artifacts = [
    await loadFixture("sys2_srs.md"),
    await loadFixture("sys2_trace_matrix.csv"),
  ];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });

  assert.equal(verdict.processId, "SYS.2");
  assert.equal(verdict.bps.length, 6, "SYS.2 has 6 base practices");
  assert.equal(verdict.pas.length, 1, "targetLevel=1 evaluates only PA 1.1");

  const bpScores = verdict.bps.map((b) => b.scorePercent);
  const avg = bpScores.reduce((a, b) => a + b, 0) / bpScores.length;
  assert.ok(avg > 0, `expected some non-zero BP scores, got ${JSON.stringify(bpScores)}`);

  const pa = verdict.pas[0];
  assert.equal(pa.paId, "PA 1.1");
  assert.ok(["N", "P-", "P+", "L-", "L+", "F"].includes(pa.rating));
  assert.ok(["N", "P", "L", "F"].includes(pa.collapsed));

  // BP5 (traceability) should score well given the fixture explicitly
  // mentions bidirectional traceability + consistency evidence.
  const bp5 = verdict.bps.find((b) => b.id === "BP5");
  assert.ok(bp5.scorePercent >= 51, `BP5 should reach L- on fixture, got ${bp5.scorePercent}`);
});

test("e2e: targetLevel=2 evaluates PA 1.1 + PA 2.1 + PA 2.2", async () => {
  const artifacts = [await loadFixture("sys2_srs.md")];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 2 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });

  const paIds = verdict.pas.map((p) => p.paId);
  assert.ok(paIds.includes("PA 1.1"));
  assert.ok(paIds.includes("PA 2.1"));
  assert.ok(paIds.includes("PA 2.2"));
  assert.ok(!paIds.includes("PA 3.1"));
});

test("e2e: capability level reported as 0-3 integer", async () => {
  const artifacts = [await loadFixture("sys2_srs.md")];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });
  assert.ok(Number.isInteger(verdict.capabilityLevel));
  assert.ok(verdict.capabilityLevel >= 0 && verdict.capabilityLevel <= 3);
});

// P6: end-to-end ratification that the Finding pipeline (P1 + P2 + P3) and
// the spec-driven standardReferences merge (P5 / P5-bis) survive a real
// harness run. Tests are written behaviourally so that extending the spec
// data or adjusting scorer wording does not silently break them.

test("e2e: every BP carries at least one finding emitted by the scorer (P3)", async () => {
  const artifacts = [await loadFixture("sys2_srs.md")];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });
  for (const bp of verdict.bps) {
    assert.ok(
      Array.isArray(bp.findings) && bp.findings.length >= 1,
      `expected ${bp.id} to emit at least one finding from ruleScorer`
    );
    const f = bp.findings[0];
    assert.equal(f.bpId, `SYS.2.${bp.id}`, "finding.bpId is fully qualified");
    assert.ok(f.situation, "finding.situation must be non-empty");
    assert.equal(f.type, "observation", "ruleScorer always emits observation findings");
  }
});

test("e2e: BPResult.standardReferences merges scorer + extracted BGB rules (P5-bis)", async () => {
  const artifacts = [await loadFixture("sys2_srs.md")];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });
  const RL_RE = /^\[[A-Z][A-Z0-9.]*\.RL\.(?:\d+|xx)\]$/;
  // SYS.2 has many BPs covered by the auto-extracted BGB CSV; at least one
  // of them should surface bracketed rule IDs once bpEvaluator unions
  // scorer refs + spec refs.
  const withBgb = verdict.bps.filter((b) => b.standardReferences.bgbRL.length > 0);
  assert.ok(
    withBgb.length > 0,
    `expected at least one SYS.2 BP to carry extracted BGB rules; got ${verdict.bps.map((b) => `${b.id}:${b.standardReferences.bgbRL.length}`).join(", ")}`
  );
  for (const bp of withBgb) {
    for (const rl of bp.standardReferences.bgbRL) assert.match(rl, RL_RE);
  }
});

test("e2e: each finding inherits the BP-level standardReferences (P5/P5-bis)", async () => {
  const artifacts = [await loadFixture("sys2_srs.md")];
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProcess({ processId: "SYS.2", artifacts });
  for (const bp of verdict.bps) {
    for (const f of bp.findings) {
      // BGB / ISO refs from the spec must be visible per finding so the UI
      // can render chips next to each finding without re-querying the spec.
      assert.deepEqual(
        f.standardReferences.bgbRL,
        bp.standardReferences.bgbRL,
        `finding ${f.id} bgbRL should match BP-level bgbRL`
      );
      assert.deepEqual(
        f.standardReferences.iso,
        bp.standardReferences.iso,
        `finding ${f.id} iso should match BP-level iso`
      );
    }
  }
});

test("evaluateProcess result carries references and meta.ratingConditionRules", async () => {
  const fixtureArtifacts = [
    await loadFixture("sys2_srs.md"),
    await loadFixture("sys2_trace_matrix.csv"),
  ];
  const v = await new Harness({ scorer: ruleScorer }).evaluateProcess({ processId: "SYS.2", artifacts: fixtureArtifacts });
  assert.ok(v.bps[0].references.pam.citation.startsWith("PAM 4.1 §4.3.2 SYS.2.BP1"));
  assert.ok(Array.isArray(v.meta.ratingConditionRules));
  assert.ok(Array.isArray(v.bps[0].appliedRules));
});
