import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getBpKnowledge,
  getGpKnowledge,
  getWpKnowledge,
  getProcessKnowledge,
  formatRulesForPrompt,
  formatNotesForPrompt,
  formatWpCharacteristics,
  MAX_RULES,
  WP_CHARS,
} from "../src/knowledge/index.js";
import { toReference } from "../src/knowledge/select.js";

test("knowledge: SWE.1.BP2 gets its own rules and references", () => {
  const k = getBpKnowledge("SWE.1", "BP2");
  const ids = k.guideline.rules.map((r) => r.id);
  assert.ok(ids.includes("SWE.1.RL.4") && ids.includes("SWE.1.RL.5") && ids.includes("SWE.1.RL.6"));
  assert.ok(!ids.includes("SWE.1.RL.1"));
  assert.equal(k.references.pam.citation, "PAM 4.1 §4.4.1 SWE.1.BP2");
  assert.equal(k.references.pam.page, 50);
  assert.ok(k.references.guideline.find((g) => g.id === "SWE.1.RL.4").effect === "cap:N");
  assert.ok(k.bp.notes.length >= 1 && k.process.outcomes.length === 7);
});
test("knowledge: trace BP gets TAC rules, communicate BP gets COM rule", () => {
  assert.ok(getBpKnowledge("SWE.1", "BP5").guideline.rules.some((r) => r.id.startsWith("TAC.RL.")));
  assert.ok(getBpKnowledge("SWE.1", "BP6").guideline.rules.some((r) => r.id === "COM.RL.1"));
  assert.ok(!getBpKnowledge("SWE.1", "BP1").guideline.rules.some((r) => r.id.startsWith("TAC.RL.")));
});
test("knowledge: MBD rule on SWE.3.BP4 is conditional", () => {
  const g = getBpKnowledge("SWE.3", "BP4").references.guideline.find((x) => x.id === "MBD.RL.5");
  assert.equal(g.conditional, "MBD");
});
test("knowledge: cross-process rule is display only", () => {
  const g = getBpKnowledge("MAN.3", "BP4").references.guideline.find((x) => x.id === "MAN.3.RL.17");
  assert.equal(g.displayOnly, true);
});
test("knowledge: GP 2.1.1 rules and GEN on PA 1.1", () => {
  assert.ok(getGpKnowledge("PA 2.1", "GP 2.1.1").guideline.rules.some((r) => r.id === "PA2.1.RL.1"));
  assert.ok(getGpKnowledge("PA 1.1", "GP 1.1.1").guideline.rules.some((r) => r.id === "GEN.RL.1"));
  assert.equal(getGpKnowledge("PA 2.1", "GP 2.1.1").references.pam.citation, "PAM 4.1 §5.3.1 GP 2.1.1");
});
test("knowledge: WP characteristics and budget", () => {
  const w = getWpKnowledge("SWE.5", "01-50");
  assert.equal(w.references.pam.citation, "PAM 4.1 Annex B 01-50");
  assert.ok(formatNotesForPrompt(getProcessKnowledge("MAN.3").guideline.notes).length <= 4 * 1300);
  assert.ok(getProcessKnowledge("MAN.3").guideline.rules.length <= 12);
});

// 보조 검증
test("knowledge: unknown ids return null", () => {
  assert.equal(getBpKnowledge("XXX.9", "BP1"), null);
  assert.equal(getBpKnowledge("SWE.1", "BP99"), null);
  assert.equal(getGpKnowledge("PA 2.1", "GP 9.9.9"), null);
  assert.equal(getGpKnowledge("PA 9.9", "GP 2.1.1"), null);
  assert.equal(getWpKnowledge("SWE.5", "99-99"), null);
  assert.equal(getProcessKnowledge("XXX.9"), null);
});
test("knowledge: rule budget and ordering (process scope before topic)", () => {
  for (const [p, b] of [["MAN.3", "BP7"], ["SWE.1", "BP5"], ["SWE.2", "BP1"]]) {
    const rules = getBpKnowledge(p, b).guideline.rules;
    assert.ok(rules.length <= MAX_RULES);
    const firstTopic = rules.findIndex((r) => r.scope.kind === "topic");
    if (firstTopic >= 0) assert.ok(rules.slice(firstTopic).every((r) => r.scope.kind === "topic"));
  }
});
test("knowledge: notes include topic note when budget remains", () => {
  const k = getBpKnowledge("SWE.1", "BP5");
  assert.ok(k.guideline.notes.length <= 4);
  assert.ok(k.guideline.notes.length >= 1);
});
test("knowledge: toReference encodes effect and summary", () => {
  const long = "가".repeat(100);
  const r = toReference({
    id: "X.RL.1", scope: { kind: "topic", id: "MBD" }, targets: [],
    effect: { kind: "cap", maxRating: "P" }, condition: { kind: "evidence" },
    text: long, section: "1 x", page: 3,
  }, { conditional: "MBD" });
  assert.equal(r.effect, "cap:P");
  assert.equal(r.summary, "가".repeat(80) + "…");
  assert.equal(r.conditional, "MBD");
  assert.equal(r.section, "1 x");
  assert.equal(r.page, 3);
  assert.equal(r.displayOnly, undefined);
});
test("knowledge: prompt formatting", () => {
  const k = getBpKnowledge("MAN.3", "BP4");
  const text = formatRulesForPrompt(k.guideline.rules);
  assert.match(text, /^- \[MAN\.3\.RL\.17\] \(하향 필수\) .*\(타 프로세스 등급 조건, 표시용\)$/m);
  const m = formatRulesForPrompt(getBpKnowledge("SWE.3", "BP4").guideline.rules);
  assert.match(m, /^- \[MBD\.RL\.5\] \(P 상한\) .*\(조건부: MBD\)$/m);
  assert.match(formatRulesForPrompt(getBpKnowledge("SWE.1", "BP2").guideline.rules), /\[SWE\.1\.RL\.4\] \(N 상한\)/);
  const n = formatNotesForPrompt([{ heading: "H", text: "T", page: 5 }, { heading: "H2", text: "T2", page: 6 }]);
  assert.equal(n, "### H (p.5)\nT\n\n### H2 (p.6)\nT2");
  const wpText = formatWpCharacteristics(getWpKnowledge("SWE.5", "01-50").wp);
  assert.ok(wpText.length > 0 && wpText.length <= WP_CHARS);
});
