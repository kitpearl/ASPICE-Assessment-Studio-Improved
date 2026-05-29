#!/usr/bin/env node
/**
 * BGB Rating Rule 추출 스크립트 (P5-bis).
 *
 * `spec/bgb/sources/ASPICE_Guideline_20240312.md` 를 스캔해 모든
 * `[<scope>.RL.<n>]` 규칙 식별자와 그 본문에서 참조된 BP id 를 매핑하여
 * `spec/bgb/bpToRatingLevels.csv` 와 `.md` 두 파일에 출력한다.
 *
 * 추출 규칙:
 *   1. process-scoped 규칙 (`[SYS.2.RL.2]`): 본문 내 `BPn` 단독 토큰은
 *      해당 프로세스의 BP 로 해석하여 (SYS.2, BPn) 행을 생성.
 *      `SWE.3.BP1` 같이 명시적인 cross-process BP 참조도 그대로 행 추가.
 *   2. environment 규칙 (`[GEN.RL.1]`, `[MBD.RL.4]` 등) 과 cross-cutting:
 *      본문 내 명시적 `<PROC>.BPn` 참조만 행으로 추가. 단순 `BPn` 은
 *      대상이 불명확하므로 스킵.
 *   3. PA-level 규칙 (`[PA2.1.RL.5]` 등): BP 가 아닌 GP 대상이므로 본
 *      추출에서는 제외 (PA/GP 매핑은 추후 별도 단계에서 처리).
 *
 * 사용법: `node packages/harness/scripts/extractBgbRules.js`
 *
 * 출력은 git-tracked 데모 파일을 덮어쓰므로 결과를 검토 후 커밋한다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const SRC = resolve(REPO_ROOT, "spec/bgb/sources/ASPICE_Guideline_20240312.md");
const OUT_CSV = resolve(REPO_ROOT, "spec/bgb/bpToRatingLevels.csv");
const OUT_MD = resolve(REPO_ROOT, "spec/bgb/bpToRatingLevels.md");

const RULE_ID_RE = /\[([A-Z][A-Z0-9.]*)\.RL\.([a-z0-9]+)\]/g;
const EXPLICIT_BP_RE = /\b([A-Z]{2,4}\.\d+)\.(BP\d+)\b/g;
const SIMPLE_BP_RE = /\b(BP\d+)\b/g;
const PROC_SCOPE_RE = /^([A-Z]{2,4}\.\d+)$/;
const PA_SCOPE_RE = /^PA[\d.]+$/;
// Distance (in chars) after a rule id to scan for BP references — capped so a
// long subsequent rule's text never bleeds into the previous one.
const SCAN_WINDOW_CHARS = 1200;

function extract() {
  const text = readFileSync(SRC, "utf8");
  const rules = [];
  // First pass: collect rule positions (char offsets).
  RULE_ID_RE.lastIndex = 0;
  let m;
  while ((m = RULE_ID_RE.exec(text)) !== null) {
    rules.push({
      ruleId: `[${m[1]}.RL.${m[2]}]`,
      scope: m[1],
      num: m[2],
      offset: m.index,
    });
  }
  // Second pass: per-rule body is the text up to the next rule (capped).
  for (let i = 0; i < rules.length; i++) {
    const start = rules[i].offset;
    const nextOffset = i + 1 < rules.length ? rules[i + 1].offset : text.length;
    const end = Math.min(nextOffset, start + SCAN_WINDOW_CHARS);
    rules[i].body = text.slice(start, end);
  }
  // Third pass: extract (processId, bpId) pairs per rule.
  const rows = [];
  const seen = new Set();
  const pushRow = (processId, bpId, ruleId) => {
    const key = `${processId}|${bpId}|${ruleId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ processId, bpId, ruleId });
  };
  for (const rule of rules) {
    if (PA_SCOPE_RE.test(rule.scope)) continue; // PA rules target GPs
    const localSeen = new Set();
    EXPLICIT_BP_RE.lastIndex = 0;
    let em;
    while ((em = EXPLICIT_BP_RE.exec(rule.body)) !== null) {
      pushRow(em[1], em[2], rule.ruleId);
      localSeen.add(`${em[1]}.${em[2]}`);
    }
    const procMatch = rule.scope.match(PROC_SCOPE_RE);
    if (procMatch) {
      const procId = procMatch[1];
      SIMPLE_BP_RE.lastIndex = 0;
      let sm;
      while ((sm = SIMPLE_BP_RE.exec(rule.body)) !== null) {
        const bpId = sm[1];
        if (localSeen.has(`${procId}.${bpId}`)) continue;
        pushRow(procId, bpId, rule.ruleId);
      }
    }
  }
  // Sort: by processId, then bpId, then ruleId.
  rows.sort((a, b) =>
    a.processId.localeCompare(b.processId, undefined, { numeric: true }) ||
    a.bpId.localeCompare(b.bpId, undefined, { numeric: true }) ||
    a.ruleId.localeCompare(b.ruleId, undefined, { numeric: true })
  );
  return rows;
}

function writeCsv(rows) {
  const header = "processId,bpId,rlId";
  const lines = [
    "# Automotive SPICE BGB Rating Rule → BP 매핑 (자동 추출).",
    "# 출처: spec/bgb/sources/ASPICE_Guideline_20240312.md (VDA QMC, 2023-11).",
    "# 추출기: scripts/extractBgbRules.js. 재실행 시 본 파일이 통째로 덮어써집니다.",
    "# rlId 표기 규칙: [<scope>.RL.<num>] (정규식: ^\\[[A-Z][A-Z0-9.]*\\.RL\\.(?:\\d+|xx)\\]$).",
    "# 한 BP 가 여러 규칙에 매핑될 수 있으므로 한 행에 하나의 (processId, bpId, rlId) 만.",
    "# 비고: PA-level rule (PA2.1.RL.*, PA3.1.RL.* 등) 은 GP 대상이라 본 표에서 제외됨.",
    header,
    ...rows.map((r) => `${r.processId},${r.bpId},${r.ruleId}`),
  ];
  writeFileSync(OUT_CSV, lines.join("\n") + "\n", "utf8");
}

function writeMd(rows) {
  const lines = [
    "# BGB Rating Rule → BP 매핑 (자동 추출)",
    "",
    "본 파일은 `scripts/extractBgbRules.js` 가 `spec/bgb/sources/ASPICE_Guideline_20240312.md` 로부터",
    "추출한 (processId, bpId, rlId) 매핑입니다. 재실행 시 본 파일이 통째로 덮어써집니다.",
    "",
    "`rlId` 표기 규칙: `[<scope>.RL.<num>]` (정규식: `^\\[[A-Z][A-Z0-9.]*\\.RL\\.(?:\\d+|xx)\\]$`).",
    "",
    "한 BP 가 여러 규칙에 매핑될 수 있으므로 한 행에 하나의 (processId, bpId, rlId) 만 기록합니다.",
    "",
    "PA-level rule (`[PA2.1.RL.*]`, `[PA3.1.RL.*]` 등) 은 BP 가 아닌 GP 를 대상으로 하므로 본 표에서 제외됩니다.",
    "",
    "## 매핑 표",
    "",
    "| processId | bpId | rlId |",
    "|-----------|------|------|",
    ...rows.map((r) => `| ${r.processId} | ${r.bpId} | ${r.ruleId} |`),
    "",
  ];
  writeFileSync(OUT_MD, lines.join("\n"), "utf8");
}

const rows = extract();
writeCsv(rows);
writeMd(rows);
console.log(
  `[extractBgbRules] wrote ${rows.length} (processId, bpId, ruleId) rows to:\n  ${OUT_CSV}\n  ${OUT_MD}`
);
