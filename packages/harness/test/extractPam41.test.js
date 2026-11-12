import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePam41 } from "../spec/extract/pam41.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../spec/sources/AutomotiveSPICE_PAM_41_ko.txt");
const text = existsSync(SRC) ? readFileSync(SRC, "utf8") : null;

test("pam41: 32 processes with expected BP counts", { skip: !text }, () => {
  const { processes } = parsePam41(text);
  assert.equal(processes.length, 32);
  const counts = Object.fromEntries(processes.map((p) => [p.id, p.basePractices.length]));
  assert.equal(counts["SWE.1"], 6);
  assert.equal(counts["SYS.4"], 5);   // "SYS.4.BP3 " 콜론 없음
  assert.equal(counts["MLE.2"], 6);   // "MLE.2.BP4 " 콜론 없음
  assert.equal(counts["SPL.2"], 8);   // "SPL2.BP7:" 점 누락
  assert.equal(counts["MAN.3"], 10);
});

test("pam41: SWE.1 fields", { skip: !text }, () => {
  const p = parsePam41(text).processes.find((x) => x.id === "SWE.1");
  assert.equal(p.name, "소프트웨어 요구사항 분석");
  assert.equal(p.pamSection, "4.4.1");
  assert.equal(p.page, 49);
  assert.match(p.purpose, /^프로세스 목적은 시스템 요구사항 및 시스템 아키텍처와 일관된/);
  assert.equal(p.outcomes.length, 7);
  const bp1 = p.basePractices[0];
  assert.equal(bp1.title, "소프트웨어 요구사항을 명세한다");
  assert.match(bp1.description, /^시스템 요구사항과 시스템 아키텍처를 사용하여/);
  assert.doesNotMatch(bp1.description, /비고/);
  assert.equal(bp1.notes.length, 4);
  assert.match(bp1.notes[0], /^비고 1: 요구사항의 특징은/);
  assert.equal(bp1.page, 50);
  assert.equal(bp1.pamCitation, "PAM 4.1 §4.4.1 SWE.1.BP1");
  assert.deepEqual(p.outputWorkProducts.map((w) => w.id).sort(), ["13-51", "13-52", "15-51", "17-00", "17-54"]);
  assert.equal(p.outputWorkProducts.find((w) => w.id === "17-00").name, "요구사항");
  assert.deepEqual(p.traceBPs, ["BP5"]);
});

test("pam41: BP description keeps bullet items and excludes scoreboard rows", { skip: !text }, () => {
  const p = parsePam41(text).processes.find((x) => x.id === "SYS.4");
  assert.match(p.basePractices[0].description, /검증 방안의 기법/);
  assert.equal(p.basePractices.filter((b) => b.id === "BP1").length, 1);
});

test("pam41: process attributes PA 1.1..5.2 and GP shapes", { skip: !text }, () => {
  const { processAttributes: pas } = parsePam41(text);
  assert.deepEqual(Object.keys(pas), ["PA 1.1","PA 2.1","PA 2.2","PA 3.1","PA 3.2","PA 4.1","PA 4.2","PA 5.1","PA 5.2"]);
  assert.equal(pas["PA 2.1"].level, 2);
  assert.equal(pas["PA 2.1"].name, "프로세스 수행 관리");
  assert.equal(pas["PA 2.1"].achievements.length, 8);
  assert.equal(pas["PA 2.1"].genericPractices.length, 6);
  assert.equal(pas["PA 2.2"].genericPractices.length, 4);   // "GP 2.2.1 제목." 콜론 없음
  const gp = pas["PA 2.1"].genericPractices[0];
  assert.equal(gp.id, "GP 2.1.1");
  assert.equal(gp.title, "프로세스 수행에 대한 목표를 식별하고 전략을 정의한다");
  assert.match(gp.description, /프로세스 활동 범위가/);
  assert.ok(gp.notes.length >= 3);
  assert.equal(gp.pamCitation, "PAM 4.1 §5.3.1 GP 2.1.1");
  assert.equal(pas["PA 1.1"].genericPractices[0].id, "GP 1.1.1");
});

test("pam41: annex B information items", { skip: !text }, () => {
  const { informationItems } = parsePam41(text);
  assert.equal(Object.keys(informationItems).length, 112);
  const it = informationItems["01-50"];
  assert.equal(it.name, "통합된 소프트웨어");
  assert.match(it.characteristics.summary, /^여러 소프트웨어 컴포넌트를 통합하여/);
  assert.deepEqual(it.characteristics.identifies, ["모든 구성된 소프트웨어 엘리먼트"]);
  assert.deepEqual(it.characteristics.includes, ["적용 매개변수"]);
  assert.deepEqual(it.characteristics.examples, ["스터빙이 포함된 시뮬레이터", "객체 코드"]);
  assert.equal(informationItems["17-00"].name, "요구사항");
});
