// 독립 평가자(independent-review) 반복 실행 결과의 과반 합의 집계 (순수 함수, LLM 호출 없음).
//
// 배경: 같은 입력을 여러 번 돌리면 LLM 판정이 흔들린다(예: 규칙 RL.10 이 4회 중 3회 TRUE, 1회 UNKNOWN).
// 한 번의 실행 결과를 그대로 믿지 않고, 전체 회차의 "절반 초과"가 같은 값일 때만 채택한다.
//  - 규칙 조건 판정(TRUE/FALSE/UNKNOWN): 과반 값을 채택. 과반이 없으면(2:2, 1:1:1 등) UNKNOWN 으로 두고 adopted=false.
//  - 문서 수준 발견(플래그): 과반 회차에서 발견된 것만 채택. 소수 회차에서만 나온 것은 "후보"로 남긴다.
//  - BP 등급: 최빈 등급이 과반일 때만 채택, 아니면 미확정(null).
// 분모는 항상 전체 회차 수다. 규칙을 찾지 못한 회차(MISSING)도 분모에 포함되어 과반을 어렵게 만든다.
// 합의는 "일관성"일 뿐 정답이 아니다: 과반이 체계적으로 틀릴 수 있다(참조 판정표·심사자 확정과 별개로 해석한다).

const VERDICTS = ["TRUE", "FALSE", "UNKNOWN"];
const isMajority = (count, n) => n > 0 && count > n / 2;

/**
 * 리뷰 마크다운의 "## D." 절 표에서 규칙 조건 판정을 추출한다.
 * 표 행의 첫 칸이 규칙 ID(예: SUP.10.RL.3, TAC.RL.1)이고, 이후 칸 중 처음 나오는 TRUE/FALSE/UNKNOWN 을 판정으로 본다.
 * 다른 절(C, E 등)의 같은 규칙 언급은 무시한다. 같은 규칙이 여러 번 나오면 첫 행만 쓴다.
 * @param {string} markdown
 * @returns {Record<string, "TRUE"|"FALSE"|"UNKNOWN">}
 */
export function parseRuleVerdicts(markdown) {
  const text = String(markdown ?? "");
  const start = text.search(/^##\s*D\./m);
  if (start < 0) return {};
  const rest = text.slice(start + 1);
  const next = rest.search(/^##\s/m);
  const section = next >= 0 ? rest.slice(0, next) : rest;
  const out = {};
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const id = (cells[0] ?? "").replace(/\*/g, "");
    if (!/^[A-Z]+(\.\d+)?\.RL\.\d+$/.test(id) || id in out) continue;
    for (const cell of cells.slice(1)) {
      const m = /^\**\s*(TRUE|FALSE|UNKNOWN)\s*\**$/.exec(cell);
      if (m) {
        out[id] = m[1];
        break;
      }
    }
  }
  return out;
}

/**
 * @param {Array<Record<string, string>>} runs 회차별 {ruleId: TRUE|FALSE|UNKNOWN}
 * @returns {Record<string, {consensus: string, adopted: boolean, agreement: number, counts: Record<string, number>, note: string}>}
 */
export function aggregateVerdicts(runs) {
  const n = runs.length;
  const ids = [...new Set(runs.flatMap((r) => Object.keys(r)))];
  const out = {};
  for (const id of ids) {
    const counts = { TRUE: 0, FALSE: 0, UNKNOWN: 0, MISSING: 0 };
    for (const r of runs) counts[VERDICTS.includes(r[id]) ? r[id] : "MISSING"]++;
    const top = VERDICTS.reduce((a, b) => (counts[b] > counts[a] ? b : a), "UNKNOWN");
    const adopted = isMajority(counts[top], n);
    out[id] = {
      consensus: adopted ? top : "UNKNOWN",
      adopted,
      agreement: n ? counts[top] / n : 0,
      counts,
      note: adopted
        ? `${n}회 중 ${counts[top]}회 ${top}${counts[top] < n ? " (소수 의견 있음)" : ""}`
        : `과반 없음(${VERDICTS.map((v) => `${v} ${counts[v]}`).join(", ")}${counts.MISSING ? `, 미확인 ${counts.MISSING}` : ""}) — UNKNOWN 으로 두고 심사자 확인`,
    };
  }
  return out;
}

/**
 * 문서 수준 발견(플래그) 집계.
 * @param {Array<Record<string, boolean>>} runs 회차별 {발견키: 발견 여부}
 * @returns {Record<string, {count: number, rate: number, adopted: boolean}>}
 */
export function aggregateFlags(runs) {
  const n = runs.length;
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r)))];
  const out = {};
  for (const k of keys) {
    const count = runs.filter((r) => r[k] === true).length;
    out[k] = { count, rate: n ? count / n : 0, adopted: isMajority(count, n) };
  }
  return out;
}

/**
 * BP 등급 집계: 최빈 등급이 과반일 때만 채택, 아니면 rating=null(미확정).
 * @param {Array<Record<string, string>>} runs 회차별 {BP키: 등급}
 */
export function aggregateRatings(runs) {
  const n = runs.length;
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r)))];
  const out = {};
  for (const k of keys) {
    const counts = {};
    for (const r of runs) if (r[k]) counts[r[k]] = (counts[r[k]] ?? 0) + 1;
    const [top, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const adopted = isMajority(topCount, n);
    out[k] = { rating: adopted ? top : null, adopted, counts };
  }
  return out;
}

/**
 * 회차별 구조화 결과를 한 번에 합의로 집계한다.
 * @param {Array<{verdicts?: Record<string,string>, flags?: Record<string,boolean>, ratings?: Record<string,string>}>} runs
 */
export function buildConsensus(runs) {
  const warnings = [];
  if (runs.length < 3) warnings.push(`회차가 ${runs.length}회로 3회 미만이라 과반 합의의 의미가 제한된다(최소 3회 권장).`);
  if (runs.length % 2 === 0 && runs.length > 0) warnings.push(`회차가 짝수(${runs.length}회)라 동수(예: 2:2)로 과반이 없는 항목이 생길 수 있다.`);
  return {
    runCount: runs.length,
    warnings,
    verdicts: aggregateVerdicts(runs.map((r) => r.verdicts ?? {})),
    flags: aggregateFlags(runs.map((r) => r.flags ?? {})),
    ratings: aggregateRatings(runs.map((r) => r.ratings ?? {})),
    interpretation: "합의는 일관성이지 정답이 아니다. 과반이 체계적으로 틀릴 수 있으므로 참조 판정표·심사자 확정과 별도로 해석한다.",
  };
}
