import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBpPrompt } from "../src/llm/prompts/bpPrompt.js";
import { buildGpPrompt } from "../src/llm/prompts/gpPrompt.js";
import { buildWpPrompt } from "../src/llm/prompts/wpPrompt.js";
import { getBpKnowledge, getGpKnowledge, getWpKnowledge } from "../src/knowledge/index.js";
import { loadProcess, loadProcessAttributes } from "../spec/canonical/index.js";

const SYSTEM_START =
  "You are a qualified Automotive SPICE PAM 4.1 assessor applying the VDA Automotive SPICE Guidelines 3rd Edition (2026).";

test("bpPrompt embeds PAM text, rules and citation", () => {
  const k = getBpKnowledge("SWE.1", "BP2");
  const p = buildBpPrompt({ process: loadProcess("SWE.1"), bp: k.bp, artifactsExcerpt: "x", projectFingerprint: "", knowledge: k });
  assert.match(p.system, /PAM 4\.1/);
  assert.match(p.context, /\[SWE\.1\.RL\.4\]/);
  assert.match(p.context, /소프트웨어 요구사항을 구조화/);
  assert.match(p.task, /PAM 4\.1 §4\.4\.1 SWE\.1\.BP2/);
  assert.match(p.task, /guidelineCitations/);
});

test("bpPrompt context blocks appear in the specified order", () => {
  const k = getBpKnowledge("SWE.1", "BP2");
  const p = buildBpPrompt({ process: loadProcess("SWE.1"), bp: k.bp, artifactsExcerpt: "EXCERPT", projectFingerprint: "fp", knowledge: k });
  assert.ok(p.system.startsWith(SYSTEM_START));
  const order = [
    "## PAM 4.1 — 프로세스",
    "## PAM 4.1 — 평가 대상 BP",
    "## 출력 정보 항목",
    "## 가이드라인 2026 — 적용 가능한 규칙",
    "## 가이드라인 2026 — 해설",
    "EXCERPT",
  ].map((h) => p.context.indexOf(h));
  assert.ok(order.every((i) => i >= 0), `missing block: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(p.task, /규칙은 조건이 증적에서 성립할 때만 applied=true/);
});

test("bpPrompt without knowledge still builds", () => {
  const process = loadProcess("SWE.1");
  const p = buildBpPrompt({ process, bp: process.basePractices[1], artifactsExcerpt: "x", projectFingerprint: "", knowledge: null });
  assert.equal(typeof p.system, "string");
  assert.equal(typeof p.context, "string");
  assert.equal(typeof p.task, "string");
  assert.ok(p.system.startsWith(SYSTEM_START));
  assert.doesNotMatch(p.context, /## 가이드라인 2026/);
  assert.match(p.task, /SWE\.1\.BP2|BP2/);
});

test("gpPrompt embeds PA text and GP citation", () => {
  const k = getGpKnowledge("PA 2.1", "GP 2.1.1");
  const paSpec = loadProcessAttributes()["PA 2.1"];
  const p = buildGpPrompt({ process: loadProcess("SWE.1"), paSpec, gp: paSpec.genericPractices[0], bpResults: [], wpResults: [], artifactsExcerpt: "x", projectFingerprint: "", knowledge: k });
  assert.ok(p.system.startsWith(SYSTEM_START));
  assert.match(p.context, /## PAM 4\.1 — 프로세스 속성/);
  assert.match(p.context, /## PAM 4\.1 — 평가 대상 GP/);
  assert.match(p.task, /PAM 4\.1 §5\.3\.1 GP 2\.1\.1/);
  assert.match(p.task, /guidelineCitations/);
});

test("wpPrompt embeds WP characteristics and Annex citation", () => {
  const process = loadProcess("SWE.1");
  const wp = process.outputWorkProducts[0];
  const k = getWpKnowledge("SWE.1", wp.id);
  const p = buildWpPrompt({ process, wp, artifactsExcerpt: "x", projectFingerprint: "", knowledge: k });
  assert.match(p.context, /## PAM 4\.1 — 정보 항목 특징/);
  assert.match(p.task, new RegExp(`PAM 4\\.1 Annex B ${wp.id}`));
});
