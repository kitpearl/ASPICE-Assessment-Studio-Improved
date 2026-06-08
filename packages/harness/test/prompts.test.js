import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBpPrompt } from "../src/llm/prompts/bpPrompt.js";
import { buildGpPrompt } from "../src/llm/prompts/gpPrompt.js";
import { buildWpPrompt } from "../src/llm/prompts/wpPrompt.js";
import { ASSESSOR_PERSONA } from "../src/llm/prompts/assessorPersona.js";
import { hasPamCitation } from "../src/evaluators/citationGuard.js";

const PROCESS = {
  id: "SWE.2",
  name: "Software Architectural Design",
  pamSection: "4.4.2",
  purpose: "정의된 소프트웨어 요구사항에 대응하는 아키텍처 설계 수립",
};

const BP = {
  id: "BP1",
  title: "소프트웨어 아키텍처 설계 수립",
  description: "정적·동적 아키텍처 측면을 정의",
};

const PA_SPEC = {
  id: "PA 1.1",
  name: "Process Performance",
  level: 1,
  scope: "기본 실행 수준",
};

const GP = {
  id: "GP 1.1.1",
  title: "프로세스 수행 결과 달성",
  description: "BP 수행을 통한 outcome 달성",
};

const WP = { id: "04-04", name: "Software Architectural Design" };

const EXCERPT = "SAD.docx §4.1: 본 명세는 정적 아키텍처를 정의한다 …";
const FINGERPRINT = "PROJECT_X, ECU_Y, MODULE_Z";

test("bpPrompt: system is the shared assessor persona (cache stability)", () => {
  const { system } = buildBpPrompt({
    process: PROCESS,
    bp: BP,
    artifactsExcerpt: EXCERPT,
    projectFingerprint: FINGERPRINT,
  });
  assert.equal(system, ASSESSOR_PERSONA);
});

test("bpPrompt: persona embeds the eight evaluation principles", () => {
  assert.match(ASSESSOR_PERSONA, /결론 진술/);
  assert.match(ASSESSOR_PERSONA, /의미적 충족/);
  assert.match(ASSESSOR_PERSONA, /객관적/);
  assert.match(ASSESSOR_PERSONA, /PAM 인용/);
  assert.match(ASSESSOR_PERSONA, /BGB Rating Level/);
  assert.match(ASSESSOR_PERSONA, /ISO/);
  assert.match(ASSESSOR_PERSONA, /Recommendation 은 반드시 동사로 시작/);
  assert.match(ASSESSOR_PERSONA, /ratingImpact/);
  assert.match(ASSESSOR_PERSONA, /작성팀/);
  assert.match(ASSESSOR_PERSONA, /경영진/);
});

test("bpPrompt: task embeds findings schema with bpId and id template", () => {
  const { task } = buildBpPrompt({
    process: PROCESS,
    bp: BP,
    artifactsExcerpt: EXCERPT,
    projectFingerprint: FINGERPRINT,
  });
  assert.match(task, /"findings":\s*\[/);
  assert.match(task, /F-SWE\.2\.BP1-01/);
  assert.match(task, /"bpId":\s*"SWE\.2\.BP1"/);
  assert.match(task, /standardReferences/);
  assert.match(task, /"situation"/);
  assert.match(task, /"gap"/);
  assert.match(task, /"impact"/);
  assert.match(task, /"recommendation"/);
  assert.match(task, /"location"/);
  assert.match(task, /"ratingImpact"/);
});

test("bpPrompt: scoring prompt is mode-independent (process === project)", () => {
  const proj = buildBpPrompt({ process: PROCESS, bp: BP, artifactsExcerpt: EXCERPT, projectFingerprint: FINGERPRINT });
  const proc = buildBpPrompt({ process: PROCESS, bp: BP, artifactsExcerpt: EXCERPT, projectFingerprint: FINGERPRINT, mode: "process" });
  // The mode-dependent "Finding 상세화" directive is gone: it biased single-
  // process runs toward lower BP scores, so the same artifact graded worse in
  // process mode than in project mode. The scoring prompt is now byte-identical
  // across modes — same prompt → same llmResponseCache key → identical grades.
  assert.equal(proc.system, proj.system);
  assert.equal(proc.context, proj.context);
  assert.equal(proc.task, proj.task);
  assert.doesNotMatch(proc.task, /단일 프로세스\(Per-process\) 모드/);
  // System prefix stays the shared persona for prompt-cache stability.
  assert.equal(proj.system, ASSESSOR_PERSONA);
  // The JSON schema tail is preserved.
  assert.match(proc.task, /"findings":\s*\[/);
});

test("bpPrompt: context includes process + fingerprint + excerpt", () => {
  const { context } = buildBpPrompt({
    process: PROCESS,
    bp: BP,
    artifactsExcerpt: EXCERPT,
    projectFingerprint: FINGERPRINT,
  });
  assert.match(context, /SWE\.2/);
  assert.match(context, /PROJECT_X/);
  assert.match(context, /SAD\.docx/);
});

test("gpPrompt: task embeds findings schema scoped to GP id", () => {
  const { system, task } = buildGpPrompt({
    process: PROCESS,
    paSpec: PA_SPEC,
    gp: GP,
    bpResults: [{ id: "BP1", rating: "L+", scorePercent: 75 }],
    wpResults: [],
    artifactsExcerpt: EXCERPT,
    projectFingerprint: FINGERPRINT,
  });
  assert.equal(system, ASSESSOR_PERSONA);
  assert.match(task, /F-SWE\.2\.GP 1\.1\.1-01/);
  assert.match(task, /"bpId":\s*"SWE\.2\.GP 1\.1\.1"/);
  assert.match(task, /"findings":\s*\[/);
  assert.match(task, /standardReferences/);
});

test("wpPrompt: task embeds findings schema scoped to WP id", () => {
  const { system, task } = buildWpPrompt({
    process: PROCESS,
    wp: WP,
    artifactsExcerpt: EXCERPT,
    projectFingerprint: FINGERPRINT,
  });
  assert.equal(system, ASSESSOR_PERSONA);
  assert.match(task, /F-SWE\.2\.04-04-01/);
  assert.match(task, /"bpId":\s*"SWE\.2\.04-04"/);
  assert.match(task, /"findings":\s*\[/);
});

// Regression: the WP prompt once instructed the LLM to write pamCitation as
// "PAM Annex B {wp.id}", a form citationGuard's CITATION_RE rejects — so every
// WP verdict fell back to score 0. Lock the JSON-schema pamCitation example in
// each prompt to a guard-passing value, and keep "Annex B" out of the WP task.
test("prompts: pamCitation schema example passes the citation guard", () => {
  const tasks = {
    bp: buildBpPrompt({ process: PROCESS, bp: BP, artifactsExcerpt: "", projectFingerprint: "" }).task,
    gp: buildGpPrompt({ process: PROCESS, paSpec: PA_SPEC, gp: GP, bpResults: [], wpResults: [], artifactsExcerpt: "", projectFingerprint: "" }).task,
    wp: buildWpPrompt({ process: PROCESS, wp: WP, artifactsExcerpt: "", projectFingerprint: "" }).task,
  };
  for (const [label, task] of Object.entries(tasks)) {
    const example = task.match(/"pamCitation":\s*"([^"]*)"/)?.[1];
    assert.ok(example, `${label}: pamCitation example missing from schema`);
    assert.ok(hasPamCitation(example), `${label}: pamCitation example "${example}" rejected by guard`);
  }
});

test("prompts: all three preserve the legacy required fields", () => {
  const bp = buildBpPrompt({ process: PROCESS, bp: BP, artifactsExcerpt: "", projectFingerprint: "" });
  const gp = buildGpPrompt({ process: PROCESS, paSpec: PA_SPEC, gp: GP, bpResults: [], wpResults: [], artifactsExcerpt: "", projectFingerprint: "" });
  const wp = buildWpPrompt({ process: PROCESS, wp: WP, artifactsExcerpt: "", projectFingerprint: "" });
  for (const { task } of [bp, gp, wp]) {
    assert.match(task, /"scorePercent"/);
    assert.match(task, /"evidence"/);
    assert.match(task, /"gaps"/);
    assert.match(task, /"pamCitation"/);
    assert.match(task, /"contextConsistency"/);
  }
});
