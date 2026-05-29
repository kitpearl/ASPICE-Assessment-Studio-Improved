import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { hasBgbRL, hasIsoClause } from "../src/evaluators/citationGuard.js";

/**
 * BGB Rating Level / ISO clause 매핑 로더.
 *
 * 두 디렉터리(spec/bgb/, spec/iso/) 의 모든 *.csv / *.md 파일을 스캔하여
 * (processId, bpId) → refId 매핑을 인메모리 인덱스로 구축한다. CSV 와 MD
 * 가 같은 디렉터리에 공존해도 무방하며, 모든 출처의 행이 union 으로 합쳐
 * 진다 (중복 자동 제거). 형식 위반 행은 silently drop 하고 누락 파일도
 * graceful 하게 빈 결과를 반환한다 (사용자가 데이터를 채우기 전까지 평가
 * 파이프라인이 깨지지 않도록).
 *
 * CSV 형식:
 *   processId,bpId,<refField>
 *   '#' 로 시작하는 행과 빈 행은 무시.
 *
 * Markdown 형식:
 *   GitHub-flavored pipe table (header + 분리선 + body) 를 인식한다.
 *   파일 안에 여러 표가 있어도 헤더가 (processId, bpId, refField) 를
 *   포함한 표만 채택된다. 표 외부의 마크다운 (제목/문장) 은 무시된다.
 *
 * refField 는 BGB 의 경우 "rlId", ISO 의 경우 "clause".
 *
 * 본 모듈은 ES module 환경에서만 동작한다 (브라우저 번들 진입점 아님).
 * UI 측은 평가 결과로 들어온 standardReferences 를 그대로 표시할 뿐, 파일
 * 자체를 읽지 않는다.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCsv(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    rows.push(line.split(",").map((c) => c.trim()));
  }
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data
    .filter((row) => row.length >= header.length && row.some((c) => c !== ""))
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
}

// "| a | b | c |" → ["a", "b", "c"]. 양 끝의 빈 칸은 trim 으로 제거된다.
function parsePipeRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

// "|---|:--:|---|" 형태의 정렬 분리선 인식.
function isSeparatorRow(line) {
  const cells = parsePipeRow(line);
  if (!cells) return false;
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/**
 * Markdown 본문에서 pipe table 들을 모두 추출해 row record 배열로 변환한다.
 * requiredFields 를 모두 포함하지 않은 표는 무시 (다른 표가 있어도 안전).
 *
 * @param {string} text
 * @param {string[]} requiredFields  예: ["processId", "bpId", "rlId"]
 * @returns {Array<Record<string,string>>}
 */
function parseMd(text, requiredFields) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  let header = null;
  let pendingSeparator = false;
  for (let i = 0; i < lines.length; i++) {
    const cells = parsePipeRow(lines[i]);
    if (!cells) {
      header = null;
      pendingSeparator = false;
      continue;
    }
    if (!header) {
      header = cells;
      pendingSeparator = true;
      continue;
    }
    if (pendingSeparator) {
      pendingSeparator = false;
      if (!isSeparatorRow(lines[i])) {
        // 분리선이 아니면 표가 아니다. 현재 줄을 새 헤더 후보로 본다.
        header = cells;
        pendingSeparator = true;
      }
      continue;
    }
    if (cells.every((c) => c === "")) continue;
    if (!requiredFields.every((f) => header.includes(f))) continue;
    const row = Object.fromEntries(header.map((h, idx) => [h, cells[idx] ?? ""]));
    out.push(row);
  }
  return out;
}

function readFileSafe(absPath) {
  try {
    return readFileSync(absPath, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function listDirSafe(absPath) {
  try {
    return readdirSync(absPath);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

/**
 * 한 디렉터리 안의 모든 *.csv / *.md 파일을 읽어 row record 배열로 합친다.
 * 호출자는 requiredFields 를 명시하여 MD 표 필터링을 가능케 한다.
 *
 * @param {string} relDir   spec 루트 기준 상대 경로 (예: "bgb")
 * @param {string[]} requiredFields
 * @returns {Array<Record<string,string>>}
 */
function loadRowsFromDir(relDir, requiredFields) {
  const dirAbs = resolve(__dirname, relDir);
  const names = listDirSafe(dirAbs).filter((n) => /\.(csv|md)$/i.test(n));
  const out = [];
  for (const name of names) {
    const text = readFileSafe(join(dirAbs, name));
    if (text == null) continue;
    if (/\.csv$/i.test(name)) out.push(...parseCsv(text));
    else if (/\.md$/i.test(name)) out.push(...parseMd(text, requiredFields));
  }
  return out;
}

let bgbIndex = null;
let isoIndex = null;

/**
 * 한 행을 key="processId.bpId" → ref[] 인덱스로 변환. 형식 위반은 drop.
 * @param {Array<Record<string, string>>} rows
 * @param {string} refField
 * @param {(s: string) => boolean} validator
 * @returns {Map<string, string[]>}
 */
function buildIndex(rows, refField, validator) {
  const map = new Map();
  for (const row of rows) {
    const processId = row.processId?.trim();
    const bpId = row.bpId?.trim();
    const ref = row[refField]?.trim();
    if (!processId || !bpId || !ref) continue;
    if (!validator(ref)) continue;
    const key = `${processId}.${bpId}`;
    const arr = map.get(key) ?? [];
    if (!arr.includes(ref)) arr.push(ref);
    map.set(key, arr);
  }
  return map;
}

export function loadBgbIndex() {
  if (bgbIndex) return bgbIndex;
  const rows = loadRowsFromDir("bgb", ["processId", "bpId", "rlId"]);
  bgbIndex = buildIndex(rows, "rlId", hasBgbRL);
  return bgbIndex;
}

export function loadIsoIndex() {
  if (isoIndex) return isoIndex;
  const rows = loadRowsFromDir("iso", ["processId", "bpId", "clause"]);
  isoIndex = buildIndex(rows, "clause", hasIsoClause);
  return isoIndex;
}

/**
 * BP 식별자(예: "SWE.2.BP1") 에 매핑된 추가 표준 인용 (BGB RL / ISO clause)
 * 을 반환한다. CSV 가 비었거나 매핑이 없으면 빈 배열을 반환한다.
 *
 * @param {string} bpFullId  예: "SWE.2.BP1" — process.id + "." + bp.id
 * @returns {{bgbRL: string[], iso: string[]}}
 */
export function lookupStandardRefs(bpFullId) {
  if (!bpFullId || typeof bpFullId !== "string") return { bgbRL: [], iso: [] };
  const bgb = loadBgbIndex().get(bpFullId) ?? [];
  const iso = loadIsoIndex().get(bpFullId) ?? [];
  return { bgbRL: [...bgb], iso: [...iso] };
}

/** 테스트 전용 — 캐시를 초기화해 파일 변경을 다시 읽을 수 있게 한다. */
export function _clearStandardRefsCache() {
  bgbIndex = null;
  isoIndex = null;
}
