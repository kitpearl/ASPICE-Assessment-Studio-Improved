import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * INCOSE Guide to Writing Requirements (GtWR) V4 평가 렌즈 로더.
 *
 * ASPICE 요구사항 분석 프로세스 (SYS.2 / SWE.1 / HWE.1) 의 BP 평가에서
 * "요구사항 명세 준수 및 검증" 을 INCOSE GtWR V4 기준 (특성 C1–C15, 작성 룰
 * R1–R42, 속성 A1–A49) 으로 추가 평가하기 위한 데이터/헬퍼를 제공한다.
 *
 *   - characteristics.json : 개별/집합 요구사항 특성
 *   - rules.json           : 작성 룰 + 룰→특성 교차참조
 *   - attributes.json      : 요구사항 속성 (검증/추적 관점 포함)
 *   - bpApplicability.json : 어떤 BP 에 어떤 특성/룰/속성을 적용할지 매핑
 *
 * 표준 인용은 "INCOSE GtWR C7" / "INCOSE GtWR R18" / "INCOSE GtWR A6" 형태의
 * 문자열로 표현하며, citationGuard.hasIncoseRef 가 검증한다. BP 평가 결과의
 * standardReferences.incose 슬롯과 각 Finding 의 동일 슬롯에 실린다.
 *
 * 본 모듈은 ES module + Node 환경에서만 동작한다 (브라우저 번들 진입점 아님).
 * UI 는 평가 결과로 들어온 standardReferences.incose 를 표시만 한다.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJsonSafe(name, fallback) {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, name), "utf8"));
  } catch {
    return fallback;
  }
}

let _characteristics = null;
let _rules = null;
let _attributes = null;
let _applicability = null;

/** @returns {{individual: any[], set: any[], byId: Map<string, any>}} */
export function loadCharacteristics() {
  if (_characteristics) return _characteristics;
  const raw = readJsonSafe("characteristics.json", { individual: [], set: [] });
  const individual = Array.isArray(raw.individual) ? raw.individual : [];
  const set = Array.isArray(raw.set) ? raw.set : [];
  const byId = new Map([...individual, ...set].map((c) => [c.id, c]));
  _characteristics = { individual, set, byId };
  return _characteristics;
}

/** @returns {{list: any[], byId: Map<string, any>}} */
export function loadRules() {
  if (_rules) return _rules;
  const raw = readJsonSafe("rules.json", { rules: [] });
  const list = Array.isArray(raw.rules) ? raw.rules : [];
  _rules = { list, byId: new Map(list.map((r) => [r.id, r])) };
  return _rules;
}

/** @returns {{groups: any[], byId: Map<string, any>}} */
export function loadAttributes() {
  if (_attributes) return _attributes;
  const raw = readJsonSafe("attributes.json", { groups: [] });
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  const byId = new Map();
  for (const g of groups) for (const a of g.attributes ?? []) byId.set(a.id, a);
  _attributes = { groups, byId };
  return _attributes;
}

/** @returns {{processes: string[], bps: Record<string, any>}} */
export function loadApplicability() {
  if (_applicability) return _applicability;
  const raw = readJsonSafe("bpApplicability.json", { processes: [], bps: {} });
  _applicability = {
    processes: Array.isArray(raw.processes) ? raw.processes : [],
    bps: raw.bps && typeof raw.bps === "object" ? raw.bps : {},
  };
  return _applicability;
}

/**
 * INCOSE GtWR 평가 렌즈가 이 프로세스에 적용되는가.
 * @param {string} processId 예: "SYS.2"
 */
export function isIncoseApplicable(processId) {
  if (!processId || typeof processId !== "string") return false;
  return loadApplicability().processes.includes(processId);
}

/**
 * BP 식별자에 매핑된 INCOSE 적용 항목(raw entry)을 반환. 없으면 null.
 * @param {string} bpFullId 예: "SYS.2.BP1"
 */
export function getBpApplicability(bpFullId) {
  if (!bpFullId || typeof bpFullId !== "string") return null;
  return loadApplicability().bps[bpFullId] ?? null;
}

/**
 * BP 식별자에 매핑된 INCOSE 표준 인용("INCOSE GtWR C#" 문자열 배열)을 반환한다.
 * BP-level 결과의 standardReferences.incose 에 실릴 "이 BP 가 평가된 INCOSE
 * 특성" 목록이다. 매핑이 없으면 빈 배열.
 *
 * 개별/집합 특성만 BP-level 에 부착한다 (룰/속성은 프롬프트 가이드 및 LLM 이
 * Finding 에서 구체 위반으로 인용 — chip 과다 노출을 피한다).
 *
 * @param {string} bpFullId 예: "SYS.2.BP1"
 * @returns {string[]}
 */
export function lookupIncoseRefs(bpFullId) {
  const entry = getBpApplicability(bpFullId);
  if (!entry) return [];
  const ids = [...(entry.individual ?? []), ...(entry.set ?? [])];
  return ids.map((id) => `INCOSE GtWR ${id}`);
}

/**
 * BP 프롬프트에 주입할 INCOSE 평가 렌즈 텍스트를 생성한다. 적용 대상이 아니면
 * 빈 문자열을 반환한다 (호출자가 falsy 체크로 비적용 처리).
 *
 * @param {string} bpFullId 예: "SYS.2.BP1"
 * @returns {string}
 */
export function buildIncoseGuidance(bpFullId) {
  const entry = getBpApplicability(bpFullId);
  if (!entry) return "";
  const { byId: charById } = loadCharacteristics();
  const { byId: ruleById } = loadRules();
  const { byId: attrById } = loadAttributes();

  const charLine = (id) => {
    const c = charById.get(id);
    return c ? `  - ${id} ${c.name}: ${c.description}` : `  - ${id}`;
  };
  const ruleLine = (id) => {
    const r = ruleById.get(id);
    return r ? `  - ${id} ${r.name}: ${r.statement}` : `  - ${id}`;
  };
  const attrLine = (id) => {
    const a = attrById.get(id);
    return a ? `  - ${id} ${a.name}${a.minimum ? " (최소 필수 속성)" : ""}` : `  - ${id}`;
  };

  const sections = [
    `# INCOSE GtWR V4 요구사항 명세 품질·검증 렌즈`,
    `  출처: INCOSE Guide to Writing Requirements V4 — Summary Sheet (INCOSE-TP-2010-006-04, 2023-06).`,
    `  PAM 의 ${bpFullId.split(".").slice(0, 2).join(".")} BP1 은 "정의된 요구사항 특성(검증가능성, 모호성 없음, 설계 자유 등)" 의 근거로 INCOSE Guide for Writing Requirements 를 명시한다.`,
    `  이 BP(${entry.label}) 에 대해 산출물의 요구사항 진술/집합이 아래 INCOSE 기준을 충족하는지 추가로 평가하라.`,
    `  중점: ${entry.focus}`,
  ];

  if (entry.individual?.length) {
    sections.push("", "## 개별 요구사항 특성 (점검 대상)");
    sections.push(...entry.individual.map(charLine));
  }
  if (entry.set?.length) {
    sections.push("", "## 요구사항 집합 특성 (점검 대상)");
    sections.push(...entry.set.map(charLine));
  }
  if (entry.rules?.length) {
    sections.push("", "## 주요 작성 룰 (위반 점검)");
    sections.push(...entry.rules.map(ruleLine));
  }
  if (entry.attributes?.length) {
    sections.push("", "## 검증·추적 관점 속성 (존재 여부 점검)");
    sections.push(...entry.attributes.map(attrLine));
  }

  sections.push(
    "",
    `## INCOSE 평가 출력 규약`,
    `  - 위반/충족이 확인된 경우 해당 Finding 의 standardReferences.incose 에 인용을 기록하라 (예: "INCOSE GtWR C7", "INCOSE GtWR R18").`,
    `  - 검증가능성(C7) 과 검증 기준 내재 여부는 PAM 의 "verification criteria being inherent in the requirements text" 요건과 함께 판단하라.`,
    `  - INCOSE 인용은 PAM·가이드라인 2026 인용을 대체하지 않는다. pamCitation 은 반드시 유지하라.`
  );

  return sections.join("\n");
}

/** 테스트 전용 — 캐시 초기화. */
export function _clearIncoseCache() {
  _characteristics = null;
  _rules = null;
  _attributes = null;
  _applicability = null;
}
