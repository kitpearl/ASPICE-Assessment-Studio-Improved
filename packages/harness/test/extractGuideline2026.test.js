import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGuideline2026 } from "../spec/extract/guideline2026.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KO = resolve(__dirname, "../spec/sources/ASPICE_Guideline_2026_ko.md");
const EN = resolve(__dirname, "../spec/sources/ASPICE_Guideline_2026_en.md");
const ko = existsSync(KO) ? readFileSync(KO, "utf8") : null;
const en = existsSync(EN) ? readFileSync(EN, "utf8") : null;

const g = ko ? parseGuideline2026(ko, en) : null;
const rules = g ? g.rules : [];
const by = (id) => {
  const r = rules.find((x) => x.id === id);
  assert.ok(r, `rule ${id} not found`);
  return r;
};

test("guideline: 254 unique rules", { skip: !ko }, () => {
  const g = parseGuideline2026(ko, en);
  assert.equal(g.rules.length, 254);
  assert.equal(new Set(g.rules.map((r) => r.id)).size, 254);
  assert.ok(g.rules.find((r) => r.id === "PA3.2.RL.10").textEn.startsWith("If the indicator GP 3.1.1"));  // EN 태그 PA.3.2 정규화
  assert.equal(g.rules.find((r) => r.id === "MLE.3.RL.1").textEn, null);
});
test("guideline: SWE.1.RL.4 cap N on SWE.1.BP2", { skip: !ko }, () => {
  const r = rules.find((x) => x.id === "SWE.1.RL.4");
  assert.deepEqual(r.scope, { kind: "process", id: "SWE.1" });
  assert.deepEqual(r.targets, [{ kind: "bp", process: "SWE.1", id: "BP2" }]);
  assert.deepEqual(r.effect, { kind: "cap", maxRating: "N" });
  assert.deepEqual(r.condition, { kind: "evidence" });
  assert.equal(r.section, "3.8.2.2 요구사항의 구조화");
  assert.equal(r.page, 120);
  assert.equal(r.citation, "Guideline 2026 §3.8.2.2 [SWE.1.RL.4]");
});
test("guideline: effects", { skip: !ko }, () => {
  assert.deepEqual(by("PA2.1.RL.1").effect, { kind: "must-not-downrate" });
  assert.deepEqual(by("PA2.1.RL.1").targets, [{ kind: "gp", id: "GP 2.1.1" }]);
  assert.deepEqual(by("SUP.10.RL.1").targets, [{ kind: "bp", process: "SUP.10", id: "BP2" }]);  // "지표 BP2" 절 보충
  assert.deepEqual(by("SUP.10.RL.1").effect, { kind: "cap", maxRating: "L" });                  // "F로 등급 평가해서는 안 된다"
  assert.deepEqual(by("MBD.RL.5").effect, { kind: "cap", maxRating: "P" });                      // "P보다 높게"
  assert.deepEqual(by("MBD.RL.5").targets, [{ kind: "bp", process: "SWE.3", id: "BP4" }]);
  assert.deepEqual(by("MBD.RL.5").scope, { kind: "topic", id: "MBD" });
  assert.deepEqual(by("SYS.2.RL.5").effect, { kind: "cap", maxRating: "N" });
  assert.equal(by("SYS.2.RL.5").inferred, true);
  assert.deepEqual(by("PIM.3.RL.2").effect, { kind: "other" });
});
test("guideline: rating conditions", { skip: !ko }, () => {
  assert.deepEqual(by("SUP.1.RL.3").condition, { kind: "rating", source: { kind: "bp", process: "SUP.1", id: "BP3" }, when: ["N", "P"] });
  assert.deepEqual(by("SUP.1.RL.3").targets, [{ kind: "pa", id: "PA 1.1" }]);
  assert.deepEqual(by("SUP.1.RL.3").effect, { kind: "cap", maxRating: "L" });
  assert.deepEqual(by("SUP.10.RL.5").effect, { kind: "cap-source" });
  assert.equal(by("PA2.1.RL.9").condition.reasonQualified, true);
  assert.deepEqual(by("PA2.1.RL.9").condition.source, { kind: "gp", id: "GP 2.1.1" });
  assert.equal(by("MAN.3.RL.17").condition.crossProcess, true);
  assert.deepEqual(by("MAN.3.RL.17").condition.source, { kind: "bp", process: "MAN.5", id: "BP5" });
  assert.equal(rules.filter((r) => r.condition.kind === "rating").length, 33);
  // Brief said 7; the KO source has only 6 rating conditions whose source BP is
  // in another process: MAN.3.RL.17–21 and REU.2.RL.3 (see task-3-report.md).
  assert.equal(rules.filter((r) => r.condition.crossProcess).length, 6);
});
test("guideline: notes", { skip: !ko }, () => {
  const n = g.notes.process["SWE.1"];
  assert.ok(n.some((x) => x.heading.startsWith("3.8.1.2") && /운영 환경/.test(x.text)));
  assert.ok(n.every((x) => x.text.length <= 1200 && !/\[SWE\.1\.RL\.\d+\]/.test(x.text)));
  assert.ok(g.notes.pa["PA 2.1"].length >= 3);
  assert.ok(g.notes.topic.TAC.length >= 1 && g.notes.topic.DEX.length >= 1);
  assert.equal(g.version, "Automotive SPICE Guidelines 3rd Edition 2026-07");
});
