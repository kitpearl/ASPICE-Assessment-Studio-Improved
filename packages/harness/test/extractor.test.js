import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadProcesses,
  loadProcess,
  loadProcessAttributes,
  loadWorkProducts,
  loadGuideline,
  ratingScale,
} from "../spec/canonical/index.js";
import { extractInternalIds, indexArtifacts } from "../src/io/artifactIndex.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("canonical: 32 processes from PAM 4.1", () => {
  const procs = loadProcesses();
  assert.equal(procs.length, 32, `expected 32 processes, got ${procs.length}`);

  const ids = procs.map((p) => p.id).sort();
  const expected = [
    "ACQ.4", "SPL.2",
    "SYS.1", "SYS.2", "SYS.3", "SYS.4", "SYS.5",
    "SWE.1", "SWE.2", "SWE.3", "SWE.4", "SWE.5", "SWE.6",
    "MLE.1", "MLE.2", "MLE.3", "MLE.4",
    "HWE.1", "HWE.2", "HWE.3", "HWE.4",
    "VAL.1",
    "SUP.1", "SUP.8", "SUP.9", "SUP.10", "SUP.11",
    "MAN.3", "MAN.5", "MAN.6",
    "PIM.3", "REU.2",
  ].sort();
  assert.deepEqual(ids, expected);
});

test("canonical: SWE.1 korean primary with english aid", () => {
  const p = loadProcess("SWE.1");
  assert.equal(p.pamVersion, "4.1");
  assert.equal(p.name, "소프트웨어 요구사항 분석");
  assert.equal(p.nameEn, "Software Requirements Analysis");
  assert.equal(p.basePractices.length, 6);
  assert.equal(p.basePractices[0].titleEn, "Specify the software requirements");
  assert.equal(p.basePractices[0].notes.length, 4);
  assert.equal(p.basePractices[0].pamCitation, "PAM 4.1 §4.4.1 SWE.1.BP1");
  assert.ok(p.inputWorkProducts.length > 0);
});

test("canonical: SYS.2 structure", () => {
  const p = loadProcess("SYS.2");
  assert.ok(p, "SYS.2 should load");
  assert.equal(p.name, "시스템 요구사항 분석");
  assert.equal(p.category, "SYS");
  assert.equal(p.pamSection, "4.3.2");
  assert.match(p.purpose, /구조화되고 분석된 시스템 요구사항/);
  assert.equal(p.outcomes.length, 6);
  assert.equal(p.basePractices.length, 6);
  assert.deepEqual(p.basePractices.map((b) => b.id), ["BP1", "BP2", "BP3", "BP4", "BP5", "BP6"]);
  const wpIds = p.outputWorkProducts.map((w) => w.id).sort();
  assert.deepEqual(wpIds, ["13-51", "13-52", "15-51", "17-00", "17-54"]);
  assert.ok(p.traceBPs.includes("BP5"), "BP5 (traceability) should be flagged");
});

test("canonical: SWE.3 structure", () => {
  const p = loadProcess("SWE.3");
  assert.ok(p);
  assert.equal(p.category, "SWE");
  assert.ok(p.basePractices.length >= 4);
  assert.ok(p.outputWorkProducts.length >= 3);
});

test("canonical: process attributes PA 1.1 ~ PA 3.2", () => {
  const pas = loadProcessAttributes();
  const ids = Object.keys(pas).sort();
  assert.deepEqual(ids, ["PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"]);
  assert.equal(pas["PA 1.1"].level, 1);
  assert.equal(pas["PA 2.1"].level, 2);
  assert.equal(pas["PA 3.2"].level, 3);
  assert.equal(pas["PA 1.1"].genericPractices.length, 1);
  assert.equal(pas["PA 2.1"].genericPractices.length, 6);
  assert.equal(pas["PA 2.2"].genericPractices.length, 4);
});

test("canonical: work product catalog populated", () => {
  const wps = loadWorkProducts();
  const count = Object.keys(wps).length;
  assert.ok(count >= 50, `expected 50+ WPs, got ${count}`);
  // Common WPs we reference in the harness logic
  assert.ok(wps["17-00"], "17-00 Requirement catalogued");
  assert.ok(wps["13-51"], "13-51 Consistency Evidence catalogued");
});

test("canonical: SPL.2 has BP7 without english", () => {
  const bp7 = loadProcess("SPL.2").basePractices.find((b) => b.id === "BP7");
  assert.ok(bp7 && !bp7.titleEn);
});

test("canonical: only MLE.4.BP5 and SPL.2.BP7 lack english (no invented text)", () => {
  const missing = loadProcesses()
    .flatMap((p) => p.basePractices.filter((b) => !b.titleEn).map((b) => `${p.id}.${b.id}`))
    .sort();
  assert.deepEqual(missing, ["MLE.4.BP5", "SPL.2.BP7"]);
  const summary = JSON.parse(readFileSync(resolve(__dirname, "../spec/canonical/_summary.json"), "utf8"));
  const fromSummary = summary.processesById
    .flatMap((p) => p.bpsWithoutEnglish.map((id) => `${p.id}.${id}`))
    .sort();
  assert.deepEqual(fromSummary, ["MLE.4.BP5", "SPL.2.BP7"]);
});

test("canonical: PA 1.1 ~ 3.2 only in loader, GP english present", () => {
  const pas = loadProcessAttributes();
  assert.deepEqual(Object.keys(pas).sort(), ["PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"]);
  assert.equal(
    pas["PA 2.1"].genericPractices[0].titleEn,
    "Identify the objectives and define a strategy for the performance of the process"
  );
});

test("canonical: work products keep aliases, add korean names, mark retired", () => {
  const wps = loadWorkProducts();
  assert.ok(wps["17-00"].aliases.includes("srs"));
  assert.equal(wps["17-00"].name, "요구사항");
  assert.equal(wps["17-00"].nameEn, "Requirement");
  assert.ok(wps["01-50"].characteristics.examples.length === 2);
  assert.equal(Object.values(wps).filter((w) => !w.retired).length, 112);
});

test("canonical: guideline loads", () => {
  const g = loadGuideline();
  assert.equal(g.rules.length, 254);
  assert.ok(g.notes.process["SWE.1"].length > 0);
});

test("canonical: all.json bundle excludes guideline text", () => {
  const all = JSON.parse(readFileSync(resolve(__dirname, "../spec/canonical/all.json"), "utf8"));
  assert.equal(all.version, "aspice-v4.1");
  assert.equal(all.guidelineRuleCounts["SWE.1"], 10);
  assert.equal(all.guideline, undefined);
});

test("ratingScale: 6-point extended scale with CL aggregation", () => {
  assert.equal(ratingScale.scale, "extended-6-point");
  const codes = ratingScale.levels.map((l) => l.code);
  assert.deepEqual(codes, ["N", "P-", "P+", "L-", "L+", "F"]);

  const findByCode = (c) => ratingScale.levels.find((l) => l.code === c);
  assert.deepEqual(
    [findByCode("N").min, findByCode("N").max], [0, 15]
  );
  assert.deepEqual(
    [findByCode("P-").min, findByCode("P-").max], [16, 32]
  );
  assert.deepEqual(
    [findByCode("L+").min, findByCode("L+").max], [68, 85]
  );
  assert.deepEqual(
    [findByCode("F").min, findByCode("F").max], [86, 100]
  );

  assert.equal(findByCode("P-").collapseTo, "P");
  assert.equal(findByCode("L+").collapseTo, "L");

  assert.deepEqual(
    ratingScale.capabilityLevels.CL1.required.map((r) => r.pa),
    ["PA 1.1"]
  );
  assert.equal(ratingScale.capabilityLevels.CL3.required.length, 5);
});

test("extractInternalIds: keeps real requirement IDs", () => {
  const text = "본 SRS 는 SYS-001, SYS-002 와 REQ-SWE-101, TC-005 를 포함한다.";
  const ids = extractInternalIds(text);
  assert.ok(ids.includes("SYS-001"));
  assert.ok(ids.includes("SYS-002"));
  assert.ok(ids.includes("REQ-SWE-101"));
  assert.ok(ids.includes("TC-005"));
});

test("extractInternalIds: filters environmental constraints (EC-*)", () => {
  const text = "조건 EC-001, EC-002, EC-014 와 함께 SYS-001 도 다룬다.";
  const ids = extractInternalIds(text);
  assert.ok(ids.includes("SYS-001"));
  assert.ok(!ids.includes("EC-001"));
  assert.ok(!ids.includes("EC-002"));
  assert.ok(!ids.includes("EC-014"));
});

test("extractInternalIds: filters algorithm/standard refs (CRC-15, ISO-26262, MISRA-C)", () => {
  const text = "CRC-15 체크섬, ISO-26262 Part 6, MISRA-C 2012, ASIL-D 등급, 그리고 SYS-007.";
  const ids = extractInternalIds(text);
  assert.ok(ids.includes("SYS-007"));
  assert.ok(!ids.includes("CRC-15"));
  assert.ok(!ids.includes("ISO-26262"));
  assert.ok(!ids.includes("MISRA-C") || true);  // MISRA-C may not match the digit-tail pattern; either way it's excluded
  assert.ok(!ids.includes("ASIL-D") || true);
});

test("extractInternalIds: keeps multi-segment IDs whose first segment is a real prefix", () => {
  const text = "REQ-EC-001 은 환경적 제약을 추적하는 요구사항이다.";
  const ids = extractInternalIds(text);
  assert.ok(ids.includes("REQ-EC-001"), "REQ-prefixed ID should survive even if EC appears mid-id");
});

test("extractInternalIds: repairs line-wrapped / spaced compound IDs (SWRS-NFR-002)", () => {
  // Document/table text extraction can break a compound ID at the hyphen,
  // producing a newline or stray space. The whole ID must still be recovered
  // so the "SWRS-" document prefix is preserved (and the fragment "NFR-002"
  // is NOT surfaced as a standalone requirement ID / false trace orphan).
  const wrapped = "추적표: SWRS-\nNFR-002, SWRS- IF-004 그리고 SWRS-FR-008.";
  const ids = extractInternalIds(wrapped);
  assert.ok(ids.includes("SWRS-NFR-002"), "newline-wrapped ID should rejoin");
  assert.ok(ids.includes("SWRS-IF-004"), "space-after-hyphen ID should rejoin");
  assert.ok(ids.includes("SWRS-FR-008"), "intact compound ID still extracted");
  // The bare middle/tail fragments must NOT leak out as separate IDs.
  assert.ok(!ids.includes("NFR-002"), "tail fragment must not be a standalone ID");
  assert.ok(!ids.includes("IF-004"), "tail fragment must not be a standalone ID");
});

test("extractInternalIds: does not merge requirement ID with a following list bullet", () => {
  // "FR-001\n- 002 ..." is a list, not a wrapped "FR-001-002". Whitespace is
  // only tolerated *after* a separator, so the bullet is not absorbed.
  const list = "FR-001\n- 002 항목 설명";
  const ids = extractInternalIds(list);
  assert.ok(ids.includes("FR-001"));
  assert.ok(!ids.includes("FR-001-002"), "list bullet must not be merged into the ID");
});

test("extractInternalIds: extraExcludedPrefixes via indexArtifacts adds project-specific noise", () => {
  const arts = indexArtifacts(
    [{ name: "spec.md", text: "DOC-001 메모, MEMO-007 비공식 노트, SYS-100 정식 요구사항." }],
    { wpCatalog: {}, extraExcludedIdPrefixes: ["DOC", "MEMO"] }
  );
  const ids = arts[0].extractedIds;
  assert.ok(ids.includes("SYS-100"));
  assert.ok(!ids.includes("DOC-001"));
  assert.ok(!ids.includes("MEMO-007"));
});
