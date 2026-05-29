import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBpPrompt } from "../src/llm/prompts/bpPrompt.js";
import { buildGpPrompt } from "../src/llm/prompts/gpPrompt.js";
import { buildWpPrompt } from "../src/llm/prompts/wpPrompt.js";
import { ASSESSOR_PERSONA } from "../src/llm/prompts/assessorPersona.js";

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
